import { z } from 'zod';

/**
 * Domínio do CRM data-driven.
 *
 * O CEO (dono do negócio) molda o CRM conforme a operação: cria funis, define
 * os pontos do funil (stages) e — o coração "data-driven" — declara quais
 * CAMPOS os cards e contatos têm. Os valores desses campos são guardados em
 * `jsonb` (mapa chave→valor), validados em runtime contra as definições.
 *
 * Aqui ficam os enums, os schemas zod (usados nas tools do agente e nas rotas)
 * e os tipos serializáveis (DTOs) que a API devolve para a UI.
 */

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

/** Tipos de campo customizável (field definitions). */
export const CRM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'select',
  'multiselect',
  'boolean',
  'email',
  'phone',
  'url',
] as const;
export type CrmFieldType = (typeof CRM_FIELD_TYPES)[number];

/** Rótulos legíveis dos tipos de campo (para a UI). */
export const CRM_FIELD_TYPE_LABELS: Record<CrmFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  currency: 'Valor (R$)',
  date: 'Data',
  select: 'Seleção única',
  multiselect: 'Seleção múltipla',
  boolean: 'Sim/Não',
  email: 'E-mail',
  phone: 'Telefone',
  url: 'Link',
};

/** A qual entidade um campo customizável pertence. */
export const CRM_FIELD_ENTITIES = ['card', 'contato'] as const;
export type CrmFieldEntity = (typeof CRM_FIELD_ENTITIES)[number];

/** Tipo/estado de um ponto do funil. */
export const CRM_STAGE_TIPOS = ['aberto', 'ganho', 'perdido'] as const;
export type CrmStageTipo = (typeof CRM_STAGE_TIPOS)[number];

/** Mapa de valores de campos customizáveis (chave → valor). */
export type CrmValores = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * Schemas (validação nas tools/rotas)
 * ------------------------------------------------------------------ */

/** Uma chave de campo é um identificador estável em snake_case. */
export const CrmFieldKeySchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case: letras minúsculas, números e _');

export const CrmFieldDefSchema = z.object({
  entidade: z.enum(CRM_FIELD_ENTITIES),
  chave: CrmFieldKeySchema,
  rotulo: z.string().min(1).max(80),
  tipo: z.enum(CRM_FIELD_TYPES),
  opcoes: z
    .array(z.string())
    .default([])
    .describe('Valores possíveis (apenas para tipos select/multiselect)'),
  obrigatorio: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
  /** Só para entidade 'card': restringe o campo a um funil; null = todos. */
  pipelineId: z.string().uuid().nullable().optional(),
});
export type CrmFieldDefInput = z.infer<typeof CrmFieldDefSchema>;

export const CrmStageInputSchema = z.object({
  nome: z.string().min(1).max(60),
  cor: z.string().max(24).optional(),
  tipo: z.enum(CRM_STAGE_TIPOS).default('aberto'),
});
export type CrmStageInput = z.infer<typeof CrmStageInputSchema>;

export const CrmPipelineInputSchema = z.object({
  nome: z.string().min(1).max(80),
  descricao: z.string().max(280).nullable().optional(),
});
export type CrmPipelineInput = z.infer<typeof CrmPipelineInputSchema>;

export const CrmContactInputSchema = z.object({
  nome: z.string().min(1).max(120),
  valores: z.record(z.string(), z.unknown()).default({}),
});
export type CrmContactInput = z.infer<typeof CrmContactInputSchema>;

export const CrmCardInputSchema = z.object({
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid().optional(),
  contatoId: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1).max(160),
  valores: z.record(z.string(), z.unknown()).default({}),
});
export type CrmCardInput = z.infer<typeof CrmCardInputSchema>;

/* ------------------------------------------------------------------ *
 * DTOs (o que a API devolve para a UI — datas como ISO string)
 * ------------------------------------------------------------------ */

export interface PipelineDTO {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  arquivado: boolean;
  criadoEm: string;
}

export interface StageDTO {
  id: string;
  pipelineId: string;
  nome: string;
  cor: string;
  tipo: CrmStageTipo;
  ordem: number;
}

export interface FieldDTO {
  id: string;
  entidade: CrmFieldEntity;
  pipelineId: string | null;
  chave: string;
  rotulo: string;
  tipo: CrmFieldType;
  opcoes: string[];
  obrigatorio: boolean;
  ordem: number;
}

export interface ContactDTO {
  id: string;
  nome: string;
  valores: CrmValores;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CardDTO {
  id: string;
  pipelineId: string;
  stageId: string;
  contatoId: string | null;
  titulo: string;
  valores: CrmValores;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** Board completo de um funil: o que a UI do kanban precisa em uma chamada. */
export interface BoardDTO {
  pipeline: PipelineDTO;
  stages: StageDTO[];
  /** Campos aplicáveis aos cards deste funil (globais + específicos). */
  fields: FieldDTO[];
  cards: CardDTO[];
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Paleta padrão dos stages (ciclada por ordem). */
export const CRM_STAGE_CORES = [
  '#64748b', // slate
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#a855f7', // purple
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
] as const;

export function corPadraoStage(ordem: number): string {
  return CRM_STAGE_CORES[ordem % CRM_STAGE_CORES.length];
}

/**
 * Deriva uma chave snake_case estável a partir de um rótulo em português
 * ("Valor estimado" → "valor_estimado"). Remove acentos e caracteres
 * especiais; garante que comece por letra.
 */
export function chaveDeRotulo(rotulo: string): string {
  const base = rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  const limpo = base.length > 0 ? base : 'campo';
  return /^[a-z]/.test(limpo) ? limpo : `c_${limpo}`;
}

/**
 * Coage/valida um valor bruto contra o tipo declarado de um campo. Retorna o
 * valor normalizado, ou lança Error com mensagem amigável quando inválido.
 * Valores vazios (undefined/null/'') viram undefined (campo não preenchido).
 */
export function normalizarValor(tipo: CrmFieldType, bruto: unknown): unknown {
  if (bruto === undefined || bruto === null || bruto === '') return undefined;

  switch (tipo) {
    case 'number':
    case 'currency': {
      const n = typeof bruto === 'number' ? bruto : Number(String(bruto).replace(',', '.'));
      if (Number.isNaN(n)) throw new Error('Valor numérico inválido');
      return n;
    }
    case 'boolean':
      return bruto === true || bruto === 'true' || bruto === 'sim' || bruto === 1;
    case 'multiselect':
      return Array.isArray(bruto) ? bruto.map(String) : [String(bruto)];
    case 'date':
      // Mantém ISO (YYYY-MM-DD ou ISO completo); validação leve.
      return String(bruto);
    default:
      return String(bruto);
  }
}

/**
 * Valida e normaliza um mapa de valores contra as definições de campos.
 * - ignora chaves sem definição (tolerante a campos removidos),
 * - aplica `normalizarValor` por tipo,
 * - exige os campos `obrigatorio`.
 */
export function validarValores(
  defs: Pick<FieldDTO, 'chave' | 'tipo' | 'obrigatorio' | 'rotulo'>[],
  valores: CrmValores,
): CrmValores {
  const out: CrmValores = {};
  const porChave = new Map(defs.map((d) => [d.chave, d]));

  for (const [chave, bruto] of Object.entries(valores ?? {})) {
    const def = porChave.get(chave);
    if (!def) continue; // campo não declarado → ignora
    const norm = normalizarValor(def.tipo, bruto);
    if (norm !== undefined) out[chave] = norm;
  }

  const faltando = defs
    .filter((d) => d.obrigatorio && out[d.chave] === undefined)
    .map((d) => d.rotulo);
  if (faltando.length > 0) {
    throw new Error(`Campos obrigatórios não preenchidos: ${faltando.join(', ')}`);
  }

  return out;
}
