import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { start } from 'workflow/api';
import { getDb } from '@/src/db';
import { deliverables, runs } from '@/src/db/schema';
import { getProfile, upsertProfile } from '@/src/lib/business';
import { BusinessProfileSchema } from '@/src/domain/business-profile';
import { PERSONA_IDS, type PersonaRunInput } from '@/src/domain/persona';
import { getPersona } from '@/src/agents/registry';
import { personaRunWorkflow } from '@/app/workflows/persona-run';

/** Contexto de tenancy injetado nas tools do CEO (escopo do usuário/negócio). */
export type CeoContext = { ownerUserId: string; businessId: string };

/**
 * Tools do agente CEO (orquestrador interativo). Todas operam no escopo do
 * negócio atual (ctx.businessId). O CEO usa estas tools para:
 *  - extrair e salvar o Perfil do Negócio,
 *  - propor um plano de trabalho (sem disparar nada),
 *  - delegar tarefas às personas (worker), iniciando runs duráveis.
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
  };
}
