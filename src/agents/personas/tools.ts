import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { buscaWeb, consultarCnpj, lerPagina } from '@/app/steps/web';
import {
  buscarArtefatosStep,
  lerArtefatoStep,
  lerEntregavelStep,
  listarEntregaveisStep,
  salvarArtefatoStep,
} from '@/app/steps/memoria';
import { criarRascunhoPostStep } from '@/app/steps/social';
import type { PersonaId } from '@/src/domain/persona';

/** Contexto de tenancy das tools de uma persona (escopo do run durável). */
export interface PersonaToolsContext {
  businessId: string;
  personaId: PersonaId;
  /** runId do Workflow, gravado como origem dos artefatos salvos. */
  runId?: string;
}

const CATEGORIAS = ['nota', 'pesquisa', 'decisao', 'referencia'] as const;

/**
 * Toolset compartilhado das personas (agentes duráveis): internet (somente
 * fontes públicas) + memória da empresa (repositório de artefatos) + leitura
 * dos entregáveis anteriores. Cada execute delega a uma função "use step",
 * então as chamadas são retryáveis e observáveis no Workflow DevKit.
 */
export function personaTools(ctx: PersonaToolsContext): ToolSet {
  const tools: ToolSet = {
    buscaWeb: tool({
      description:
        'Busca na web (somente fontes públicas) por informações reais: mercado, ' +
        'concorrentes, tendências, referências e canais. Retorna resultados com ' +
        'URLs — cite as fontes no que você produzir. Quando vier uma "resposta" ' +
        'sintetizada, confira as fontes antes de afirmar algo.',
      inputSchema: z.object({
        query: z.string().describe('O termo de busca em português'),
      }),
      execute: buscaWeb,
    }),

    lerPagina: tool({
      description:
        'Lê o conteúdo de uma página pública da web (texto limpo, sem HTML). ' +
        'Use depois da buscaWeb para aprofundar numa fonte: site de concorrente, ' +
        'matéria, catálogo, página de evento. Apenas URLs públicas http(s).',
      inputSchema: z.object({
        url: z.string().describe('A URL pública da página a ler'),
      }),
      execute: lerPagina,
    }),

    consultarCnpj: tool({
      description:
        'Consulta os dados públicos de um CNPJ no cadastro da Receita Federal ' +
        '(razão social, atividade, município, porte, situação). Informação ' +
        'pública por lei — útil para qualificar empresas em pesquisa e ' +
        'prospecção B2B. Nunca use para obter contatos pessoais.',
      inputSchema: z.object({
        cnpj: z.string().describe('O CNPJ (com ou sem pontuação)'),
      }),
      execute: consultarCnpj,
    }),

    consultarMemoria: tool({
      description:
        'Busca na memória da empresa (artefatos salvos: notas, pesquisas, ' +
        'decisões e referências de trabalhos anteriores). SEMPRE consulte no ' +
        'início da tarefa para aproveitar o que o time já aprendeu sobre este ' +
        'negócio e não repetir trabalho. Sem query, lista os mais recentes.',
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe('Texto a procurar em títulos e conteúdos'),
        categoria: z.enum(CATEGORIAS).optional(),
      }),
      execute: ({ query, categoria }) =>
        buscarArtefatosStep({ businessId: ctx.businessId, query, categoria }),
    }),

    lerArtefato: tool({
      description:
        'Lê o conteúdo completo de um artefato da memória da empresa (use o id ' +
        'retornado por consultarMemoria).',
      inputSchema: z.object({
        artifactId: z.string().describe('O id do artefato'),
      }),
      execute: ({ artifactId }) =>
        lerArtefatoStep({ businessId: ctx.businessId, artifactId }),
    }),

    salvarArtefato: tool({
      description:
        'Salva um achado importante na memória da empresa, para o CEO e as ' +
        'outras personas aproveitarem depois: fatos descobertos na pesquisa, ' +
        'decisões tomadas, referências úteis. Salve ao final do trabalho um ' +
        'resumo dos achados que NÃO estão óbvios no entregável. Título curto, ' +
        'conteúdo em markdown.',
      inputSchema: z.object({
        titulo: z.string().describe('Título curto e descritivo'),
        categoria: z.enum(CATEGORIAS),
        conteudo: z.string().describe('O conteúdo em markdown'),
        tags: z.array(z.string()).optional().describe('Etiquetas para busca'),
      }),
      execute: ({ titulo, categoria, conteudo, tags }) =>
        salvarArtefatoStep({
          businessId: ctx.businessId,
          autor: ctx.personaId,
          titulo,
          categoria,
          conteudo,
          tags,
          runId: ctx.runId,
        }),
    }),

    listarEntregaveis: tool({
      description:
        'Lista os entregáveis que o time já produziu para este negócio ' +
        '(títulos e datas). Use para saber o que já foi feito antes de começar.',
      inputSchema: z.object({}),
      execute: () => listarEntregaveisStep({ businessId: ctx.businessId }),
    }),

    lerEntregavel: tool({
      description:
        'Lê um entregável anterior completo (use o id de listarEntregaveis). ' +
        'Útil para alinhar seu trabalho com o que outra persona já entregou.',
      inputSchema: z.object({
        deliverableId: z.string().describe('O id do entregável'),
      }),
      execute: ({ deliverableId }) =>
        lerEntregavelStep({ businessId: ctx.businessId, deliverableId }),
    }),
  };

  // Só a persona de Conteúdo & Aquisição pode enfileirar posts para publicação:
  // ela escreve a legenda e manda para a fila de Publicações do dono como
  // RASCUNHO (origem ia_sugestao). O dono revisa, anexa imagem, escolhe a rede
  // e publica — a IA nunca publica sozinha (mesmo guardrail das outras levas).
  if (ctx.personaId === 'conteudo-aquisicao') {
    tools.criarRascunhoPost = tool({
      description:
        'Envia um POST PRONTO para a fila de Publicações do dono (Facebook/' +
        'Instagram) como RASCUNHO aguardando aprovação. Chame ao escrever cada ' +
        'post pronto para publicar (a legenda completa, com chamada para ação). ' +
        'O dono revisa, anexa a imagem, escolhe a rede e publica — você NUNCA ' +
        'publica sozinho. Envie só o texto da legenda (a imagem é do dono).',
      inputSchema: z.object({
        texto: z
          .string()
          .describe('A legenda/copy completa do post, pronta para publicar'),
        canalSugerido: z
          .string()
          .optional()
          .describe('Rede sugerida: "Instagram" ou "Facebook" (só orientação)'),
      }),
      execute: ({ texto, canalSugerido }) =>
        criarRascunhoPostStep({
          businessId: ctx.businessId,
          texto,
          canalSugerido,
          runId: ctx.runId,
        }),
    });
  }

  return tools;
}
