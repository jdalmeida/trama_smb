import type { PersonaId } from '@/src/domain/persona';

/**
 * Cor de identidade de cada persona — o "código de cor" do DESIGN.md
 * (Conteúdo=âmbar, Mercado=azul, Prospecção=verde). É wayfinding: deixa o
 * Time e os Entregáveis escaneáveis por quem-fez-o-quê. A cor nunca anda
 * sozinha (Regra do Sinal Duplo): vem sempre com o ícone e o nome da persona.
 *
 * As classes são strings literais completas de propósito — o JIT do Tailwind
 * só gera o utilitário que enxerga no código-fonte; concatenar o nome do token
 * dinamicamente faria a cor sumir do build.
 */
export interface PersonaTheme {
  /** Selo do ícone: tom suave de fundo + a cor cheia no glifo. */
  iconChip: string;
  /** Bolinha de cor usada como marcador em listas densas. */
  dot: string;
  /** Aro tonal para realçar identidade (uso pontual). */
  ring: string;
}

export const PERSONA_THEME: Record<PersonaId, PersonaTheme> = {
  'conteudo-aquisicao': {
    iconChip: 'bg-persona-conteudo/12 text-persona-conteudo',
    dot: 'bg-persona-conteudo',
    ring: 'ring-persona-conteudo/40',
  },
  'pesquisa-mercado': {
    iconChip: 'bg-persona-mercado/12 text-persona-mercado',
    dot: 'bg-persona-mercado',
    ring: 'ring-persona-mercado/40',
  },
  'vendas-prospeccao': {
    iconChip: 'bg-persona-prospeccao/12 text-persona-prospeccao',
    dot: 'bg-persona-prospeccao',
    ring: 'ring-persona-prospeccao/40',
  },
};
