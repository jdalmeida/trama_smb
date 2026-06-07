import { z } from 'zod';

/**
 * Entregável da persona "Conteúdo & Aquisição": plano de conteúdo e canais.
 */
export const ContentPlanSchema = z.object({
  resumo: z.string().describe('Resumo do plano em 2-3 frases'),
  posicionamento: z.string().describe('Como o negócio deve se posicionar nos canais'),
  canais: z
    .array(
      z.object({
        canal: z.string().describe('Ex.: Instagram, WhatsApp, Google Meu Negócio'),
        porque: z.string().describe('Por que esse canal faz sentido para este negócio'),
        frequencia: z.string().describe('Cadência sugerida (ex.: 3x/semana)'),
      }),
    )
    .describe('Canais priorizados'),
  calendario: z
    .array(
      z.object({
        dia: z.string().describe('Ex.: "Seg, semana 1"'),
        canal: z.string(),
        formato: z.string().describe('Ex.: Reels, post, story, artigo'),
        tema: z.string(),
        gancho: z.string().describe('Gancho/ângulo da publicação'),
      }),
    )
    .describe('Calendário inicial (ex.: 2 semanas)'),
  ideiasProntas: z
    .array(
      z.object({
        titulo: z.string(),
        canal: z.string(),
        texto: z.string().describe('Rascunho pronto para publicar'),
      }),
    )
    .describe('3-5 ideias de post prontas'),
});
export type ContentPlan = z.infer<typeof ContentPlanSchema>;

/**
 * Entregável da persona "Pesquisa de Mercado".
 */
export const MarketResearchSchema = z.object({
  panorama: z.string().describe('Panorama do mercado/segmento'),
  concorrentes: z
    .array(
      z.object({
        nome: z.string(),
        oQueFazem: z.string(),
        forcas: z.array(z.string()).default([]),
        brechas: z.array(z.string()).default([]),
        fonte: z.string().describe('URL pública').optional(),
      }),
    )
    .describe('2-3 concorrentes (somente fontes públicas)'),
  segmentos: z
    .array(
      z.object({
        nome: z.string(),
        descricao: z.string(),
        comoAlcancar: z.string(),
      }),
    )
    .describe('Segmentos de cliente'),
  sugestoesPosicionamento: z.array(z.string()).describe('Sugestões de posicionamento'),
});
export type MarketResearch = z.infer<typeof MarketResearchSchema>;

/** Conteúdo persistido na coluna jsonb de `deliverables`. */
export type DeliverableContent =
  | ({ tipo: 'plano-conteudo' } & ContentPlan)
  | ({ tipo: 'pesquisa-mercado' } & MarketResearch)
  | { tipo: 'texto'; texto: string };
