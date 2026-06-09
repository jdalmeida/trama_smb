import type { PersonaId } from '@/src/domain/persona';
import type { ModelTier } from '@/src/ai/models';

/** Configuração de uma persona (worker). O conhecimento fica em src/skills/<skillFile>.md */
export interface PersonaConfig {
  id: PersonaId;
  nome: string;
  descricao: string;
  emoji: string;
  /** Nome do arquivo (sem extensão) em src/skills/ */
  skillFile: string;
  modelTier: ModelTier;
}

export const PERSONAS: Record<PersonaId, PersonaConfig> = {
  'conteudo-aquisicao': {
    id: 'conteudo-aquisicao',
    nome: 'Conteúdo & Aquisição',
    descricao:
      'Cria plano de conteúdo e canais para atrair clientes: temas, ganchos, calendário e posts prontos.',
    emoji: '✍️',
    skillFile: 'conteudo-aquisicao',
    modelTier: 'worker',
  },
  'pesquisa-mercado': {
    id: 'pesquisa-mercado',
    nome: 'Pesquisa de Mercado',
    descricao:
      'Mapeia o mercado e concorrentes (fontes públicas), define segmentos de cliente e sugere posicionamento.',
    emoji: '🔎',
    skillFile: 'pesquisa-mercado',
    modelTier: 'worker',
  },
  'vendas-prospeccao': {
    id: 'vendas-prospeccao',
    nome: 'Vendas / Prospecção',
    descricao:
      'Mapeia oportunidades públicas de captação (eventos, feiras, marketplaces, parcerias) e monta um plano de prospecção priorizado — o contato é sempre feito pelo dono.',
    emoji: '🤝',
    skillFile: 'vendas-prospeccao',
    modelTier: 'worker',
  },
};

export const PERSONA_LIST: PersonaConfig[] = Object.values(PERSONAS);

export function getPersona(id: PersonaId): PersonaConfig {
  return PERSONAS[id];
}
