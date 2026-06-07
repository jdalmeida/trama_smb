import type { BusinessProfile } from './business-profile';

/** IDs das personas disponíveis (workers). */
export const PERSONA_IDS = ['conteudo-aquisicao', 'pesquisa-mercado'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

/** Estado de uma persona/entregável, exibido no painel "Time". */
export type PersonaStatus = 'idle' | 'working' | 'done' | 'error';

/** Entrada de um run durável de persona (passado ao Workflow). */
export interface PersonaRunInput {
  businessId: string;
  personaId: PersonaId;
  /** Tarefa em linguagem natural delegada pelo CEO. */
  tarefa: string;
  /** Snapshot do perfil — o worker não precisa tocar o banco para ter contexto. */
  profile: BusinessProfile;
  /** Linha de deliverable pré-criada (status 'working') que o run vai preencher. */
  deliverableId: string;
}

/**
 * Eventos que o worker transmite (stream) para a UI atualizar o painel "Time".
 * Vão pelo stream do run do Workflow, namespace "status".
 */
export type PersonaStatusEvent =
  | { kind: 'status'; personaId: PersonaId; status: PersonaStatus; mensagem?: string }
  | { kind: 'atividade'; personaId: PersonaId; texto: string }
  | { kind: 'entregavel'; personaId: PersonaId; deliverableId: string };
