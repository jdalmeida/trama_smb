import { z } from 'zod';

/**
 * Domínio do "Piloto automático" do atendimento omnichannel.
 *
 * Depois que o DONO inicia a conversa com um lead, ele pode ligar o piloto: um
 * agente de atendimento passa a responder o lead sozinho E extrai SINAIS da
 * conversa (interesse, pedido de orçamento, objeção, menção a concorrente...).
 * Esses sinais são entregues ao CEO, que reage de forma autônoma — mexe no CRM
 * e/ou dispara uma pesquisa de mercado em paralelo.
 *
 * Guardrail (coerente com o resto do omnichannel): o contato é sempre INICIADO
 * pelo dono; o piloto só pode ser ligado numa conversa que já tem mensagem do
 * dono, e ele consente explicitamente ao ativar. Nada de outreach em massa.
 *
 * Aqui ficam os enums, os schemas zod (rotas/tools/output do agente) e os DTOs
 * serializáveis que a API devolve para a UI.
 */

/* ------------------------------------------------------------------ *
 * Sinais (insights que o atendimento manda ao CEO)
 * ------------------------------------------------------------------ */

/**
 * Tipos de sinal que o agente de atendimento extrai da conversa. A taxonomia é
 * enxuta de propósito: cada tipo aponta para uma reação possível do CEO —
 * evolução comercial (mexe no CRM) ou oportunidade de investigar (dispara
 * pesquisa). `outro` é a válvula de escape para algo relevante fora da lista.
 */
export const LEAD_SIGNAL_TIPOS = [
  'interesse_compra',
  'pedido_orcamento',
  'agendamento',
  'duvida_produto',
  'objecao',
  'dado_cadastral',
  'mencao_concorrente',
  'oportunidade_mercado',
  'insatisfacao',
  'sem_interesse',
  'outro',
] as const;
export type LeadSignalTipo = (typeof LEAD_SIGNAL_TIPOS)[number];

export const LEAD_SIGNAL_TIPO_LABELS: Record<LeadSignalTipo, string> = {
  interesse_compra: 'Interesse de compra',
  pedido_orcamento: 'Pedido de orçamento',
  agendamento: 'Quer agendar',
  duvida_produto: 'Dúvida sobre o produto',
  objecao: 'Objeção',
  dado_cadastral: 'Dado de cadastro',
  mencao_concorrente: 'Mencionou concorrente',
  oportunidade_mercado: 'Oportunidade de mercado',
  insatisfacao: 'Insatisfação',
  sem_interesse: 'Sem interesse',
  outro: 'Outro',
};

/** Prioridade do sinal — orienta o CEO sobre o quanto agir. */
export const LEAD_SIGNAL_PRIORIDADES = ['baixa', 'media', 'alta'] as const;
export type LeadSignalPrioridade = (typeof LEAD_SIGNAL_PRIORIDADES)[number];

/** Ciclo de vida de um sinal até o CEO reagir. */
export const LEAD_SIGNAL_STATUSES = [
  'novo',
  'processando',
  'processado',
  'ignorado',
  'erro',
] as const;
export type LeadSignalStatus = (typeof LEAD_SIGNAL_STATUSES)[number];

/* ------------------------------------------------------------------ *
 * DTOs
 * ------------------------------------------------------------------ */

/** Um sinal detectado numa conversa, com o que o CEO fez a respeito. */
export interface ChannelSignalDTO {
  id: string;
  conversationId: string;
  tipo: LeadSignalTipo;
  resumo: string;
  prioridade: LeadSignalPrioridade;
  status: LeadSignalStatus;
  /** Resumo do que o CEO fez ao reagir (preenchido quando processado). */
  acaoCeo: string | null;
  criadoEm: string;
  processadoEm: string | null;
}

/** Estado do piloto automático de uma conversa (devolvido junto da conversa). */
export interface AutopilotEstadoDTO {
  ativo: boolean;
  /** Diretriz opcional do dono sobre como o agente deve conduzir (tom/limites). */
  instrucao: string | null;
}

/* ------------------------------------------------------------------ *
 * Schemas (validação nas rotas)
 * ------------------------------------------------------------------ */

/**
 * Corpo do toggle do piloto automático. `instrucao` deixa o dono orientar a
 * condução (ex.: "ofereça até 10% de desconto, tente agendar uma visita").
 */
export const AutopilotToggleSchema = z.object({
  ativo: z.boolean(),
  instrucao: z.string().max(600).optional(),
});
export type AutopilotToggleInput = z.infer<typeof AutopilotToggleSchema>;

/* ------------------------------------------------------------------ *
 * Output estruturado do agente de atendimento
 *
 * O agente faz, numa única passada, as duas coisas: redige a próxima resposta
 * para o lead e lista os sinais que valem ser enviados ao CEO.
 * ------------------------------------------------------------------ */

/** Um sinal proposto pelo agente (antes de persistir). */
export const AtendimentoSinalSchema = z.object({
  tipo: z.enum(LEAD_SIGNAL_TIPOS),
  resumo: z
    .string()
    .max(280)
    .describe('Frase curta e factual do que o lead sinalizou'),
  prioridade: z.enum(LEAD_SIGNAL_PRIORIDADES).default('media'),
});
export type AtendimentoSinal = z.infer<typeof AtendimentoSinalSchema>;

/** Saída completa de uma rodada de atendimento autônomo. */
export const AtendimentoOutputSchema = z.object({
  /**
   * `false` quando não há nada a responder agora (ex.: a última fala já foi do
   * negócio, ou a mensagem não pede resposta) — o piloto fica em silêncio.
   */
  deveResponder: z.boolean(),
  /** A próxima mensagem para o lead. Vazia quando deveResponder é false. */
  resposta: z.string().max(2000),
  /** Sinais relevantes para o CEO. Vazio quando não há nada digno de nota. */
  sinais: z.array(AtendimentoSinalSchema).default([]),
});
export type AtendimentoOutput = z.infer<typeof AtendimentoOutputSchema>;
