import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  apagarCard,
  apagarField,
  apagarStage,
  atualizarCard,
  atualizarContato,
  atualizarField,
  atualizarPipeline,
  atualizarStage,
  criarCard,
  criarContato,
  criarField,
  criarPipeline,
  criarStage,
  getBoard,
  listarContatos,
  listarFields,
  listarPipelines,
  listarStages,
  moverCard,
  resumoCrm,
} from '@/src/lib/crm';
import {
  CRM_FIELD_ENTITIES,
  CRM_FIELD_TYPES,
  CRM_STAGE_TIPOS,
} from '@/src/domain/crm';
import {
  apagarAutomacao,
  atualizarAutomacao,
  criarAutomacao,
  listarAutomacoes,
  listarRuns,
  processarTemporais,
} from '@/src/lib/crm-automation';
import {
  CRM_TRIGGERS,
  CrmAcaoSchema,
  CrmCondicaoSchema,
} from '@/src/domain/crm-automation';
import {
  apagarAtividade,
  atualizarAtividade,
  concluirAtividade,
  criarAtividade,
  listarAtividades,
} from '@/src/lib/crm-activity';
import { CRM_ACTIVITY_TIPOS } from '@/src/domain/crm-activity';

/** Contexto de tenancy das tools do agente CRM (escopo do negócio). */
export interface CrmAgentContext {
  businessId: string;
}

/**
 * Toolset do agente CRM. Cobre as duas frentes do CRM data-driven:
 *  - CONFIGURAR: funis (pipelines), pontos (stages) e os campos customizáveis
 *    de cards e contatos — é o dono moldando o CRM conforme o negócio.
 *  - OPERAR: contatos, cards, mover cards entre pontos do funil.
 *
 * Tudo escopado a ctx.businessId. As funções da lib já validam tenancy e os
 * valores contra as definições de campo; aqui só expomos com boas descrições.
 */
export function crmTools(ctx: CrmAgentContext): ToolSet {
  const b = ctx.businessId;

  return {
    /* ---------------- Visão geral ---------------- */
    resumoCrm: tool({
      description:
        'Resumo do CRM atual: funis existentes, seus pontos, quantos campos e ' +
        'cards cada um tem. SEMPRE chame isto no início para conhecer o estado ' +
        'antes de criar ou alterar qualquer coisa (e usar os ids corretos).',
      inputSchema: z.object({}),
      execute: () => resumoCrm(b),
    }),

    /* ---------------- Funis (pipelines) ---------------- */
    listarFunis: tool({
      description: 'Lista os funis (pipelines) do negócio com seus ids.',
      inputSchema: z.object({}),
      execute: () => listarPipelines(b),
    }),

    criarFunil: tool({
      description:
        'Cria um novo funil. Informe os pontos iniciais (stages) na ordem do ' +
        'fluxo — do primeiro contato até ganho/perdido. Use tipo "ganho" para o ' +
        'ponto de fechamento e "perdido" para descarte; os demais são "aberto".',
      inputSchema: z.object({
        nome: z.string().describe('Nome do funil, ex.: "Vendas" ou "Pós-venda"'),
        descricao: z.string().optional(),
        pontos: z
          .array(
            z.object({
              nome: z.string(),
              tipo: z.enum(CRM_STAGE_TIPOS).default('aberto'),
            }),
          )
          .min(1)
          .describe('Pontos do funil, na ordem'),
      }),
      execute: async ({ nome, descricao, pontos }) => {
        const { pipeline, stages } = await criarPipeline(b, {
          nome,
          descricao: descricao ?? null,
          stages: pontos,
        });
        return { ok: true as const, pipeline, stages };
      },
    }),

    editarFunil: tool({
      description: 'Renomeia, edita a descrição ou arquiva um funil.',
      inputSchema: z.object({
        pipelineId: z.string(),
        nome: z.string().optional(),
        descricao: z.string().nullable().optional(),
        arquivado: z.boolean().optional(),
      }),
      execute: async ({ pipelineId, ...patch }) => {
        const pipeline = await atualizarPipeline(b, pipelineId, patch);
        return pipeline
          ? { ok: true as const, pipeline }
          : { ok: false as const, erro: 'Funil não encontrado' };
      },
    }),

    /* ---------------- Pontos do funil (stages) ---------------- */
    listarPontos: tool({
      description: 'Lista os pontos (stages) de um funil, na ordem.',
      inputSchema: z.object({ pipelineId: z.string() }),
      execute: ({ pipelineId }) => listarStages(b, pipelineId),
    }),

    criarPonto: tool({
      description: 'Adiciona um ponto a um funil (vai para o fim).',
      inputSchema: z.object({
        pipelineId: z.string(),
        nome: z.string(),
        tipo: z.enum(CRM_STAGE_TIPOS).default('aberto'),
      }),
      execute: async ({ pipelineId, nome, tipo }) => {
        const stage = await criarStage(b, pipelineId, { nome, tipo });
        return { ok: true as const, stage };
      },
    }),

    editarPonto: tool({
      description: 'Edita nome, cor (hex) ou tipo de um ponto do funil.',
      inputSchema: z.object({
        stageId: z.string(),
        nome: z.string().optional(),
        cor: z.string().optional(),
        tipo: z.enum(CRM_STAGE_TIPOS).optional(),
      }),
      execute: async ({ stageId, ...patch }) => {
        const stage = await atualizarStage(b, stageId, patch);
        return stage
          ? { ok: true as const, stage }
          : { ok: false as const, erro: 'Ponto não encontrado' };
      },
    }),

    apagarPonto: tool({
      description:
        'Apaga um ponto do funil. Os cards são movidos para outro ponto ' +
        '(informe paraStageId, ou cairão no primeiro restante). Não dá para ' +
        'apagar o último ponto de um funil.',
      inputSchema: z.object({
        stageId: z.string(),
        paraStageId: z.string().optional(),
      }),
      execute: async ({ stageId, paraStageId }) => {
        await apagarStage(b, stageId, paraStageId);
        return { ok: true as const };
      },
    }),

    /* ---------------- Campos customizáveis (data-driven) ---------------- */
    listarCampos: tool({
      description:
        'Lista os campos customizáveis de "card" ou "contato". Para card, pode ' +
        'filtrar por funil (pipelineId) — retorna globais + os do funil.',
      inputSchema: z.object({
        entidade: z.enum(CRM_FIELD_ENTITIES),
        pipelineId: z.string().optional(),
      }),
      execute: ({ entidade, pipelineId }) =>
        listarFields(b, { entidade, pipelineId }),
    }),

    criarCampo: tool({
      description:
        'Cria um campo customizável. Para campos de "card", deixe pipelineId ' +
        'vazio para valer em todos os funis, ou informe um funil específico. ' +
        'Para tipos "select"/"multiselect", liste as opções. A chave é derivada ' +
        'do rótulo automaticamente.',
      inputSchema: z.object({
        entidade: z.enum(CRM_FIELD_ENTITIES),
        rotulo: z.string().describe('Nome visível do campo, ex.: "Valor estimado"'),
        tipo: z.enum(CRM_FIELD_TYPES),
        opcoes: z.array(z.string()).optional().describe('Para select/multiselect'),
        obrigatorio: z.boolean().default(false),
        pipelineId: z
          .string()
          .nullable()
          .optional()
          .describe('Só para card; null/ausente = vale em todos os funis'),
      }),
      execute: async ({ entidade, rotulo, tipo, opcoes, obrigatorio, pipelineId }) => {
        const field = await criarField(b, {
          entidade,
          rotulo,
          tipo,
          opcoes: opcoes ?? [],
          obrigatorio: obrigatorio ?? false,
          pipelineId: pipelineId ?? null,
        });
        return { ok: true as const, field };
      },
    }),

    editarCampo: tool({
      description: 'Edita rótulo, tipo, opções ou obrigatoriedade de um campo.',
      inputSchema: z.object({
        fieldId: z.string(),
        rotulo: z.string().optional(),
        tipo: z.enum(CRM_FIELD_TYPES).optional(),
        opcoes: z.array(z.string()).optional(),
        obrigatorio: z.boolean().optional(),
      }),
      execute: async ({ fieldId, ...patch }) => {
        const field = await atualizarField(b, fieldId, patch);
        return field
          ? { ok: true as const, field }
          : { ok: false as const, erro: 'Campo não encontrado' };
      },
    }),

    apagarCampo: tool({
      description:
        'Remove uma definição de campo. Os valores já gravados nos cards/' +
        'contatos param de aparecer, mas não são perdidos do banco.',
      inputSchema: z.object({ fieldId: z.string() }),
      execute: async ({ fieldId }) => {
        await apagarField(b, fieldId);
        return { ok: true as const };
      },
    }),

    /* ---------------- Contatos ---------------- */
    listarContatos: tool({
      description: 'Lista/busca contatos do negócio (filtro opcional por nome).',
      inputSchema: z.object({ query: z.string().optional() }),
      execute: ({ query }) => listarContatos(b, { query }),
    }),

    criarContato: tool({
      description:
        'Cria um contato. "valores" é um mapa chave→valor usando as CHAVES dos ' +
        'campos de contato (veja listarCampos entidade=contato).',
      inputSchema: z.object({
        nome: z.string(),
        valores: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async ({ nome, valores }) => {
        const contato = await criarContato(b, { nome, valores: valores ?? {} });
        return { ok: true as const, contato };
      },
    }),

    editarContato: tool({
      description: 'Edita o nome e/ou os valores de um contato.',
      inputSchema: z.object({
        contatoId: z.string(),
        nome: z.string().optional(),
        valores: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async ({ contatoId, ...patch }) => {
        const contato = await atualizarContato(b, contatoId, patch);
        return contato
          ? { ok: true as const, contato }
          : { ok: false as const, erro: 'Contato não encontrado' };
      },
    }),

    /* ---------------- Cards ---------------- */
    verFunil: tool({
      description:
        'Mostra o board de um funil: pontos, campos de card e os cards com seus ' +
        'valores. Use para saber o que existe antes de operar cards.',
      inputSchema: z.object({ pipelineId: z.string() }),
      execute: ({ pipelineId }) => getBoard(b, pipelineId),
    }),

    criarCard: tool({
      description:
        'Cria um card (negócio/lead) num funil. Se não informar stageId, entra ' +
        'no primeiro ponto. "valores" usa as CHAVES dos campos de card. Vincule ' +
        'um contato com contatoId quando fizer sentido.',
      inputSchema: z.object({
        pipelineId: z.string(),
        stageId: z.string().optional(),
        titulo: z.string(),
        contatoId: z.string().nullable().optional(),
        valores: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async ({ pipelineId, stageId, titulo, contatoId, valores }) => {
        const card = await criarCard(b, {
          pipelineId,
          stageId,
          titulo,
          contatoId: contatoId ?? null,
          valores: valores ?? {},
        });
        return { ok: true as const, card };
      },
    }),

    editarCard: tool({
      description: 'Edita título, contato vinculado e/ou valores de um card.',
      inputSchema: z.object({
        cardId: z.string(),
        titulo: z.string().optional(),
        contatoId: z.string().nullable().optional(),
        valores: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async ({ cardId, ...patch }) => {
        const card = await atualizarCard(b, cardId, patch);
        return card
          ? { ok: true as const, card }
          : { ok: false as const, erro: 'Card não encontrado' };
      },
    }),

    moverCard: tool({
      description:
        'Move um card para outro ponto do funil (avança ou regride no fluxo). ' +
        'O card vai para o fim da coluna destino.',
      inputSchema: z.object({ cardId: z.string(), stageId: z.string() }),
      execute: async ({ cardId, stageId }) => {
        const card = await moverCard(b, cardId, stageId);
        return card
          ? { ok: true as const, card }
          : { ok: false as const, erro: 'Card não encontrado' };
      },
    }),

    apagarCard: tool({
      description: 'Apaga um card do funil.',
      inputSchema: z.object({ cardId: z.string() }),
      execute: async ({ cardId }) => {
        await apagarCard(b, cardId);
        return { ok: true as const };
      },
    }),

    /* ---------------- Automações ---------------- */
    listarAutomacoes: tool({
      description:
        'Lista as automações de um funil (regras gatilho → condições → ações) ' +
        'com seus ids e se estão ativas. Veja antes de criar para não duplicar.',
      inputSchema: z.object({ pipelineId: z.string() }),
      execute: ({ pipelineId }) => listarAutomacoes(b, pipelineId),
    }),

    criarAutomacao: tool({
      description:
        'Cria uma automação num funil. Estrutura: QUANDO (gatilho) → SE ' +
        '(condições, opcionais, todas precisam bater) → ENTÃO (ações). ' +
        'Gatilhos: "card_criado", "card_movido" (use triggerStageId para o ponto ' +
        'de entrada que dispara) e "card_atualizado". Condições comparam um campo ' +
        '(chave do campo, ou "__titulo") com um operador. Ações: mover_card ' +
        '(stageId), definir_campo (chave+valor) e registrar_nota (titulo+conteudo; ' +
        'use {card} para inserir o título do card). Confira as chaves/ids com ' +
        'verFunil/listarCampos/listarPontos antes.',
      inputSchema: z.object({
        pipelineId: z.string(),
        nome: z.string(),
        trigger: z.enum(CRM_TRIGGERS),
        triggerStageId: z
          .string()
          .nullable()
          .optional()
          .describe('Só para card_movido: ponto de entrada que dispara'),
        triggerDias: z
          .number()
          .int()
          .min(1)
          .nullable()
          .optional()
          .describe('Só para card_parado: nº de dias parado no ponto que dispara'),
        condicoes: z.array(CrmCondicaoSchema).optional(),
        acoes: z.array(CrmAcaoSchema).min(1),
        enabled: z.boolean().default(true),
      }),
      execute: async ({
        pipelineId,
        nome,
        trigger,
        triggerStageId,
        triggerDias,
        condicoes,
        acoes,
        enabled,
      }) => {
        const automacao = await criarAutomacao(b, {
          pipelineId,
          nome,
          trigger,
          triggerStageId: triggerStageId ?? null,
          triggerDias: triggerDias ?? null,
          condicoes: condicoes ?? [],
          acoes,
          enabled: enabled ?? true,
        });
        return { ok: true as const, automacao };
      },
    }),

    editarAutomacao: tool({
      description:
        'Edita uma automação: renomear, ativar/desativar (enabled), trocar as ' +
        'condições ou ações.',
      inputSchema: z.object({
        automationId: z.string(),
        nome: z.string().optional(),
        enabled: z.boolean().optional(),
        condicoes: z.array(CrmCondicaoSchema).optional(),
        acoes: z.array(CrmAcaoSchema).optional(),
      }),
      execute: async ({ automationId, ...patch }) => {
        const automacao = await atualizarAutomacao(b, automationId, patch);
        return automacao
          ? { ok: true as const, automacao }
          : { ok: false as const, erro: 'Automação não encontrada' };
      },
    }),

    apagarAutomacao: tool({
      description: 'Remove uma automação.',
      inputSchema: z.object({ automationId: z.string() }),
      execute: async ({ automationId }) => {
        await apagarAutomacao(b, automationId);
        return { ok: true as const };
      },
    }),

    historicoAutomacoes: tool({
      description:
        'Mostra o histórico recente de execução das automações (o que rodou e o ' +
        'resultado). Útil para conferir se uma automação está funcionando.',
      inputSchema: z.object({ pipelineId: z.string().optional() }),
      execute: ({ pipelineId }) => listarRuns(b, { pipelineId }),
    }),

    rodarAutomacoesParadas: tool({
      description:
        'Roda agora a verificação dos gatilhos de "card parado há X dias" (em vez ' +
        'de esperar o tick diário). Útil para testar uma automação temporal. ' +
        'Retorna quantas dispararam.',
      inputSchema: z.object({}),
      execute: async () => {
        const disparos = await processarTemporais(b);
        return { ok: true as const, disparos };
      },
    }),

    /* ---------------- Agenda ---------------- */
    listarAtividades: tool({
      description:
        'Lista as atividades da agenda (tarefas, follow-ups, ligações, reuniões). ' +
        'Filtre por status ("pendente"/"concluida"/"todas") e por card.',
      inputSchema: z.object({
        status: z.enum(['pendente', 'concluida', 'todas']).optional(),
        cardId: z.string().optional(),
      }),
      execute: ({ status, cardId }) => listarAtividades(b, { status, cardId }),
    }),

    criarAtividade: tool({
      description:
        'Agenda uma atividade. "inicioEm" é uma data/hora ISO (ex.: ' +
        '"2026-06-20T14:00:00"); use diaInteiro=true para compromissos sem hora. ' +
        'Vincule a um card (cardId) e/ou contato (contatoId) quando fizer sentido.',
      inputSchema: z.object({
        titulo: z.string(),
        tipo: z.enum(CRM_ACTIVITY_TIPOS).default('tarefa'),
        inicioEm: z.string().describe('Data/hora ISO de início'),
        diaInteiro: z.boolean().default(false),
        descricao: z.string().optional(),
        cardId: z.string().nullable().optional(),
        contatoId: z.string().nullable().optional(),
      }),
      execute: async ({ titulo, tipo, inicioEm, diaInteiro, descricao, cardId, contatoId }) => {
        const atividade = await criarAtividade(b, {
          titulo,
          tipo,
          inicioEm,
          diaInteiro,
          descricao: descricao ?? null,
          cardId: cardId ?? null,
          contatoId: contatoId ?? null,
        });
        return { ok: true as const, atividade };
      },
    }),

    concluirAtividade: tool({
      description: 'Marca uma atividade como concluída (ou reabre com concluida=false).',
      inputSchema: z.object({
        activityId: z.string(),
        concluida: z.boolean().default(true),
      }),
      execute: async ({ activityId, concluida }) => {
        const atividade = await concluirAtividade(b, activityId, concluida);
        return atividade
          ? { ok: true as const, atividade }
          : { ok: false as const, erro: 'Atividade não encontrada' };
      },
    }),

    editarAtividade: tool({
      description: 'Edita uma atividade (título, tipo, data, descrição, vínculos).',
      inputSchema: z.object({
        activityId: z.string(),
        titulo: z.string().optional(),
        tipo: z.enum(CRM_ACTIVITY_TIPOS).optional(),
        inicioEm: z.string().optional(),
        diaInteiro: z.boolean().optional(),
        descricao: z.string().nullable().optional(),
        cardId: z.string().nullable().optional(),
        contatoId: z.string().nullable().optional(),
      }),
      execute: async ({ activityId, ...patch }) => {
        const atividade = await atualizarAtividade(b, activityId, patch);
        return atividade
          ? { ok: true as const, atividade }
          : { ok: false as const, erro: 'Atividade não encontrada' };
      },
    }),

    apagarAtividade: tool({
      description: 'Apaga uma atividade da agenda.',
      inputSchema: z.object({ activityId: z.string() }),
      execute: async ({ activityId }) => {
        await apagarAtividade(b, activityId);
        return { ok: true as const };
      },
    }),
  };
}
