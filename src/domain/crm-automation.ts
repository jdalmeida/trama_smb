import { z } from 'zod';
import { CRM_ACTIVITY_TIPOS } from '@/src/domain/crm-activity';

/**
 * Domínio das automações do CRM (Leva 2).
 *
 * Uma automação é uma regra do dono: QUANDO algo acontece no funil (gatilho),
 * SE as condições baterem, ENTÃO executa ações. Tudo data-driven: os gatilhos,
 * condições e ações são configurados pelo dono (UI ou agente), guardados em
 * `jsonb` e avaliados em runtime pelo motor (src/lib/crm-automation.ts).
 *
 * Escopo da Leva 2: gatilhos por EVENTO (disparam no momento da ação no CRM).
 * Gatilhos temporais ("parado há N dias") dependem de agenda/cron e ficam para
 * a Leva 3. As ações são determinísticas e NÃO re-disparam automações (evita
 * laços) — ver o motor.
 */

/* ------------------------------------------------------------------ *
 * Gatilhos
 * ------------------------------------------------------------------ */

export const CRM_TRIGGERS = [
  'card_criado',
  'card_movido',
  'card_atualizado',
  'card_parado',
] as const;
export type CrmTrigger = (typeof CRM_TRIGGERS)[number];

export const CRM_TRIGGER_LABELS: Record<CrmTrigger, string> = {
  card_criado: 'Quando um card é criado',
  card_movido: 'Quando um card entra num ponto',
  card_atualizado: 'Quando um card é editado',
  card_parado: 'Quando um card fica parado X dias',
};

/** Gatilhos avaliados por tempo (rodam no "tick" diário, não por evento). */
export const CRM_TRIGGERS_TEMPORAIS: CrmTrigger[] = ['card_parado'];

/* ------------------------------------------------------------------ *
 * Condições
 * ------------------------------------------------------------------ */

export const CRM_OPERADORES = [
  'igual',
  'diferente',
  'contem',
  'maior',
  'menor',
  'vazio',
  'preenchido',
] as const;
export type CrmOperador = (typeof CRM_OPERADORES)[number];

export const CRM_OPERADOR_LABELS: Record<CrmOperador, string> = {
  igual: 'é igual a',
  diferente: 'é diferente de',
  contem: 'contém',
  maior: 'é maior que',
  menor: 'é menor que',
  vazio: 'está vazio',
  preenchido: 'está preenchido',
};

/** Operadores que não usam o campo "valor". */
export const OPERADORES_SEM_VALOR: CrmOperador[] = ['vazio', 'preenchido'];

/** Campo especial: o título do card (além das chaves dos campos data-driven). */
export const CAMPO_TITULO = '__titulo';

export const CrmCondicaoSchema = z.object({
  /** Chave de um campo do card, ou `__titulo`. */
  campo: z.string().min(1),
  operador: z.enum(CRM_OPERADORES),
  valor: z.string().optional(),
});
export type CrmCondicao = z.infer<typeof CrmCondicaoSchema>;

/* ------------------------------------------------------------------ *
 * Ações
 * ------------------------------------------------------------------ */

export const CRM_ACAO_TIPOS = [
  'mover_card',
  'definir_campo',
  'registrar_nota',
  'criar_atividade',
] as const;
export type CrmAcaoTipo = (typeof CRM_ACAO_TIPOS)[number];

export const CRM_ACAO_LABELS: Record<CrmAcaoTipo, string> = {
  mover_card: 'Mover o card para um ponto',
  definir_campo: 'Preencher um campo do card',
  registrar_nota: 'Registrar uma nota na memória',
  criar_atividade: 'Agendar uma atividade',
};

export const CrmAcaoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('mover_card'),
    stageId: z.string().uuid().describe('Ponto do funil de destino'),
  }),
  z.object({
    tipo: z.literal('definir_campo'),
    chave: z.string().min(1).describe('Chave do campo do card'),
    valor: z.string().describe('Valor a gravar'),
  }),
  z.object({
    tipo: z.literal('registrar_nota'),
    titulo: z.string().min(1),
    conteudo: z.string().min(1).describe('Conteúdo em markdown (pode citar o card)'),
  }),
  z.object({
    tipo: z.literal('criar_atividade'),
    titulo: z.string().min(1).describe('Título da atividade (use {card} p/ o card)'),
    tipoAtividade: z.enum(CRM_ACTIVITY_TIPOS).default('followup'),
    emDias: z.number().int().min(0).default(0).describe('Daqui a quantos dias (0 = hoje)'),
    descricao: z.string().optional(),
  }),
]);
export type CrmAcao = z.infer<typeof CrmAcaoSchema>;

/* ------------------------------------------------------------------ *
 * Automação (input + DTO)
 * ------------------------------------------------------------------ */

export const CrmAutomationInputSchema = z
  .object({
    pipelineId: z.string().uuid(),
    nome: z.string().min(1).max(120),
    trigger: z.enum(CRM_TRIGGERS),
    /** Só para `card_movido`: o ponto de entrada que dispara; null = qualquer. */
    triggerStageId: z.string().uuid().nullable().optional(),
    /** Só para `card_parado`: nº de dias parado no ponto que dispara. */
    triggerDias: z.number().int().min(1).max(365).nullable().optional(),
    condicoes: z.array(CrmCondicaoSchema).default([]),
    acoes: z.array(CrmAcaoSchema).min(1, 'Defina ao menos uma ação'),
    enabled: z.boolean().default(true),
  })
  .refine((a) => a.trigger === 'card_movido' || !a.triggerStageId, {
    message: 'triggerStageId só vale para o gatilho "card entra num ponto"',
    path: ['triggerStageId'],
  })
  .refine((a) => a.trigger !== 'card_parado' || (a.triggerDias ?? 0) >= 1, {
    message: 'Informe os dias parado (triggerDias) para este gatilho',
    path: ['triggerDias'],
  });
export type CrmAutomationInput = z.infer<typeof CrmAutomationInputSchema>;

export const CRM_AUTOMATION_RUN_STATUS = ['ok', 'erro'] as const;
export type CrmAutomationRunStatus = (typeof CRM_AUTOMATION_RUN_STATUS)[number];

export interface AutomationDTO {
  id: string;
  pipelineId: string;
  nome: string;
  trigger: CrmTrigger;
  triggerStageId: string | null;
  triggerDias: number | null;
  condicoes: CrmCondicao[];
  acoes: CrmAcao[];
  enabled: boolean;
  ordem: number;
  criadoEm: string;
}

export interface AutomationRunDTO {
  id: string;
  automationId: string | null;
  cardId: string | null;
  status: CrmAutomationRunStatus;
  mensagem: string;
  criadoEm: string;
}
