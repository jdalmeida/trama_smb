import { z } from 'zod';

/**
 * Domínio da agenda do CRM (Leva 3).
 *
 * Uma atividade é um compromisso/tarefa do dono: follow-up, ligação, reunião,
 * etc. Pode estar ligada a um card e/ou contato, ou ser solta. Alimenta a
 * visão de agenda/calendário e pode ser criada automaticamente por automações.
 */

export const CRM_ACTIVITY_TIPOS = [
  'tarefa',
  'ligacao',
  'reuniao',
  'followup',
  'email',
] as const;
export type CrmActivityTipo = (typeof CRM_ACTIVITY_TIPOS)[number];

export const CRM_ACTIVITY_LABELS: Record<CrmActivityTipo, string> = {
  tarefa: 'Tarefa',
  ligacao: 'Ligação',
  reuniao: 'Reunião',
  followup: 'Follow-up',
  email: 'E-mail',
};

/** Emoji por tipo (usado na agenda). */
export const CRM_ACTIVITY_EMOJI: Record<CrmActivityTipo, string> = {
  tarefa: '✓',
  ligacao: '📞',
  reuniao: '🤝',
  followup: '🔔',
  email: '✉️',
};

export const CrmActivityInputSchema = z.object({
  titulo: z.string().min(1).max(160),
  tipo: z.enum(CRM_ACTIVITY_TIPOS).default('tarefa'),
  descricao: z.string().max(1000).nullable().optional(),
  /** Data/hora de início (ISO). Para `diaInteiro`, a parte de hora é ignorada. */
  inicioEm: z.string().min(1),
  fimEm: z.string().nullable().optional(),
  diaInteiro: z.boolean().default(false),
  cardId: z.string().uuid().nullable().optional(),
  contatoId: z.string().uuid().nullable().optional(),
});
export type CrmActivityInput = z.infer<typeof CrmActivityInputSchema>;

export interface ActivityDTO {
  id: string;
  titulo: string;
  tipo: CrmActivityTipo;
  descricao: string | null;
  inicioEm: string;
  fimEm: string | null;
  diaInteiro: boolean;
  concluida: boolean;
  concluidaEm: string | null;
  cardId: string | null;
  /** Título do card vinculado (desnormalizado para a UI), se houver. */
  cardTitulo: string | null;
  contatoId: string | null;
  criadoEm: string;
}
