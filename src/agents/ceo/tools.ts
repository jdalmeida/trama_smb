import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { start } from 'workflow/api';
import { getDb } from '@/src/db';
import { deliverables, runs } from '@/src/db/schema';
import { getProfile, upsertProfile } from '@/src/lib/business';
import {
  buscarArtefatos,
  criarArtefato,
  lerArtefato,
  lerEntregavel,
  listarEntregaveis,
} from '@/src/lib/artifacts';
import { iniciarPlano } from '@/src/lib/orchestrate';
import { BusinessProfileSchema } from '@/src/domain/business-profile';
import { PERSONA_IDS, type PersonaRunInput } from '@/src/domain/persona';
import { getPersona } from '@/src/agents/registry';
import { personaRunWorkflow } from '@/app/workflows/persona-run';
import { getCrmAgent } from '@/src/agents/crm/agent';
import { resumoCrm } from '@/src/lib/crm';

/** Contexto de tenancy injetado nas tools do CEO (escopo do usuário/negócio). */
export type CeoContext = { ownerUserId: string; businessId: string };

/**
 * Tools do agente CEO (orquestrador interativo). Todas operam no escopo do
 * negócio atual (ctx.businessId). O CEO usa estas tools para:
 *  - extrair e salvar o Perfil do Negócio,
 *  - propor um plano de trabalho (sem disparar nada),
 *  - delegar tarefas às personas (worker), iniciando runs duráveis,
 *  - consultar/alimentar a memória da empresa e os entregáveis anteriores.
 */
export function ceoTools(ctx: CeoContext): ToolSet {
  return {
    salvarPerfil: tool({
      description:
        'Salva (rascunho) o Perfil do Negócio extraído da conversa. O perfil ' +
        'fica como NÃO verificado — o usuário ainda vai confirmar na interface ' +
        'antes de virar oficial. Use assim que tiver todos os campos do perfil.',
      inputSchema: BusinessProfileSchema,
      execute: async (input) => {
        await upsertProfile(ctx.businessId, input, false);
        return { ok: true as const, perfil: input };
      },
    }),

    lerPerfil: tool({
      description:
        'Lê o Perfil do Negócio já salvo, se houver. Retorna o perfil ' +
        '(objeto) ou null quando ainda não foi preenchido. Use antes de ' +
        'propor um plano ou delegar tarefas, para conhecer o contexto.',
      inputSchema: z.object({}),
      execute: async () => {
        const row = await getProfile(ctx.businessId);
        return row?.profile ?? null;
      },
    }),

    proporPlano: tool({
      description:
        'Apresenta ao usuário um plano de trabalho: um resumo do que será ' +
        'feito e quais personas (especialistas) serão acionadas. NÃO dispara ' +
        'nenhum trabalho — apenas registra a proposta para a interface exibir. ' +
        'Use para alinhar com o usuário antes de delegar.',
      inputSchema: z.object({
        resumo: z.string().describe('Resumo do plano em linguagem natural'),
        personas: z
          .array(z.enum(PERSONA_IDS))
          .describe('Personas que serão acionadas no plano'),
      }),
      execute: async (input) => {
        return { ok: true as const, plano: input };
      },
    }),

    delegarTarefa: tool({
      description:
        'Delega uma tarefa a uma persona especialista, iniciando o trabalho ' +
        'dela em segundo plano (run durável). Use somente após o perfil estar ' +
        'salvo e o plano alinhado com o usuário. Retorna os IDs para a ' +
        'interface acompanhar o andamento.',
      inputSchema: z.object({
        personaId: z
          .enum(PERSONA_IDS)
          .describe('Qual persona/especialista vai executar a tarefa'),
        tarefa: z
          .string()
          .describe('Descrição da tarefa em linguagem natural para a persona'),
      }),
      execute: async ({ personaId, tarefa }) => {
        // 1) Precisa de perfil para dar contexto à persona.
        const prof = await getProfile(ctx.businessId);
        if (!prof) {
          return {
            ok: false as const,
            erro:
              'Perfil do Negócio ainda não foi preenchido. Complete e salve o ' +
              'perfil antes de delegar tarefas às personas.',
          };
        }

        const persona = getPersona(personaId);
        const db = getDb();

        // 2) Cria a linha de entregável (status "working") que o run vai preencher.
        const [deliverable] = await db
          .insert(deliverables)
          .values({
            businessId: ctx.businessId,
            personaId,
            titulo: `${persona.nome}: ${tarefa}`,
            tarefa,
            status: 'working',
          })
          .returning();
        const deliverableId = deliverable.id;

        // 3) Monta a entrada do run durável (snapshot do perfil incluso).
        const input: PersonaRunInput = {
          businessId: ctx.businessId,
          personaId,
          tarefa,
          profile: prof.profile,
          deliverableId,
        };

        // 4) Dispara o workflow durável da persona.
        const run = await start(personaRunWorkflow, [input]);
        const runId = run.runId;

        // 5) Registra o run para a interface conseguir reconectar o stream.
        await db.insert(runs).values({
          businessId: ctx.businessId,
          personaId,
          runId,
          deliverableId,
          status: 'working',
        });

        // 6) Devolve IDs para a UI assinar o stream do run.
        return {
          ok: true as const,
          deliverableId,
          runId,
          personaId,
          persona: persona.nome,
        };
      },
    }),

    delegarPlano: tool({
      description:
        'Delega um plano inteiro de uma vez: aciona VÁRIAS personas via o ' +
        'orquestrador durável (rodam em paralelo). Use quando o plano alinhado ' +
        'com o usuário envolve 2 ou mais personas. Para uma única persona, ' +
        'prefira delegarTarefa. Use somente após o perfil salvo e o plano aprovado.',
      inputSchema: z.object({
        tarefas: z
          .array(
            z.object({
              personaId: z
                .enum(PERSONA_IDS)
                .describe('Qual persona executa esta tarefa'),
              tarefa: z
                .string()
                .describe('Tarefa em linguagem natural, específica para o negócio'),
            }),
          )
          .min(1)
          .describe('Uma entrada por persona a acionar'),
      }),
      execute: async ({ tarefas }) => {
        const prof = await getProfile(ctx.businessId);
        if (!prof) {
          return {
            ok: false as const,
            erro:
              'Perfil do Negócio ainda não foi preenchido. Complete e salve o ' +
              'perfil antes de delegar o plano.',
          };
        }

        const plano = await iniciarPlano(ctx.businessId, prof.profile, tarefas);
        return {
          ok: true as const,
          orchestratorRunId: plano.orchestratorRunId,
          itens: plano.itens,
        };
      },
    }),

    delegarAoCrm: tool({
      description:
        'Aciona o agente de CRM para configurar ou operar o CRM do negócio a ' +
        'partir de um pedido em linguagem natural: criar/ajustar funis, pontos ' +
        'do funil, campos de cadastro (data-driven), e cadastrar/mover negócios ' +
        '(cards) e contatos. Use quando o dono falar em organizar clientes, ' +
        'oportunidades, funil de vendas, etapas ou cadastros. O agente de CRM ' +
        'executa as mudanças na hora e devolve um resumo do que fez.',
      inputSchema: z.object({
        pedido: z
          .string()
          .describe(
            'O que fazer no CRM, em linguagem natural e específico para este ' +
              'negócio. Ex.: "criar um funil de vendas com etapas Lead, ' +
              'Proposta, Fechado e um campo de Valor estimado".',
          ),
      }),
      execute: async ({ pedido }) => {
        const agente = getCrmAgent({ businessId: ctx.businessId });
        const resultado = await agente.generate({ prompt: pedido });
        return { ok: true as const, resumo: resultado.text };
      },
    }),

    consultarCrm: tool({
      description:
        'Lê um resumo do CRM atual (funis, pontos e contagem de campos/cards). ' +
        'Use para saber como o CRM está montado antes de propor mudanças ou de ' +
        'delegar ao agente de CRM.',
      inputSchema: z.object({}),
      execute: async () => {
        return { resumo: await resumoCrm(ctx.businessId) };
      },
    }),

    consultarMemoria: tool({
      description:
        'Busca na memória da empresa: artefatos salvos pelo time (notas, ' +
        'achados de pesquisa, decisões, referências). Consulte antes de propor ' +
        'um plano ou delegar, para aproveitar o que já foi aprendido e dar ' +
        'tarefas mais bem contextualizadas. Sem query, lista os mais recentes.',
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe('Texto a procurar em títulos e conteúdos'),
        categoria: z
          .enum(['nota', 'pesquisa', 'decisao', 'referencia'])
          .optional(),
      }),
      execute: async ({ query, categoria }) => {
        return buscarArtefatos(ctx.businessId, { query, categoria });
      },
    }),

    lerArtefato: tool({
      description:
        'Lê o conteúdo completo de um artefato da memória da empresa (use o ' +
        'id retornado por consultarMemoria).',
      inputSchema: z.object({
        artifactId: z.string().describe('O id do artefato'),
      }),
      execute: async ({ artifactId }) => {
        const row = await lerArtefato(ctx.businessId, artifactId);
        if (!row) return null;
        return {
          id: row.id,
          titulo: row.titulo,
          categoria: row.categoria,
          autor: row.autor,
          tags: row.tags,
          conteudo: row.conteudo,
          criadoEm: row.createdAt.toISOString(),
        };
      },
    }),

    salvarNaMemoria: tool({
      description:
        'Salva um fato importante na memória da empresa, para você e as ' +
        'personas usarem depois: decisões do dono ("não quer vender online"), ' +
        'contexto que não cabe no perfil, preferências, restrições. Use quando ' +
        'a conversa revelar algo durável que vale lembrar. Título curto, ' +
        'conteúdo em markdown.',
      inputSchema: z.object({
        titulo: z.string().describe('Título curto e descritivo'),
        categoria: z.enum(['nota', 'pesquisa', 'decisao', 'referencia']),
        conteudo: z.string().describe('O conteúdo em markdown'),
        tags: z.array(z.string()).optional().describe('Etiquetas para busca'),
      }),
      execute: async ({ titulo, categoria, conteudo, tags }) => {
        const row = await criarArtefato({
          businessId: ctx.businessId,
          autor: 'ceo',
          titulo,
          categoria,
          conteudo,
          tags,
        });
        return { ok: true as const, id: row.id, titulo: row.titulo };
      },
    }),

    listarEntregaveis: tool({
      description:
        'Lista os entregáveis que o time já produziu para este negócio ' +
        '(título, persona, status e data). Use para responder "o que já foi ' +
        'feito" e para evitar delegar trabalho repetido.',
      inputSchema: z.object({}),
      execute: async () => {
        return listarEntregaveis(ctx.businessId);
      },
    }),

    lerEntregavel: tool({
      description:
        'Lê um entregável completo (use o id de listarEntregaveis). Útil para ' +
        'comentar resultados com o dono e encadear próximos passos.',
      inputSchema: z.object({
        deliverableId: z.string().describe('O id do entregável'),
      }),
      execute: async ({ deliverableId }) => {
        const row = await lerEntregavel(ctx.businessId, deliverableId);
        if (!row) return null;
        return {
          id: row.id,
          titulo: row.titulo,
          personaId: row.personaId,
          status: row.status,
          content: row.content,
          criadoEm: row.createdAt.toISOString(),
        };
      },
    }),
  };
}
