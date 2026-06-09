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

/**
 * Entregável da persona "Vendas / Prospecção": plano de prospecção com
 * oportunidades PÚBLICAS de captação. Nunca contém contatos pessoais —
 * o contato é sempre feito pelo próprio dono (LGPD/CDC).
 */
export const ProspectingPlanSchema = z.object({
  resumo: z.string().describe('Resumo do plano de prospecção em 2-3 frases'),
  criteriosPriorizacao: z
    .string()
    .describe('Como as oportunidades foram priorizadas (esforço, custo, encaixe com o público)'),
  oportunidades: z
    .array(
      z.object({
        nome: z.string().describe('Nome da oportunidade (ex.: feira X, marketplace Y)'),
        tipo: z
          .string()
          .describe(
            'Tipo: evento, feira, marketplace, associação comercial, licitação pública, comunidade, parceria local',
          ),
        ondeEncontrar: z
          .string()
          .describe('Onde encontrar (site/canal público; URL quando houver)'),
        porQueVale: z.string().describe('Por que vale para este negócio'),
        primeiroPasso: z
          .string()
          .describe('Primeiro passo concreto que o DONO executa manualmente'),
        prioridade: z.enum(['alta', 'media', 'baixa']).describe('Prioridade sugerida'),
      }),
    )
    .describe('Oportunidades públicas de captação, priorizadas'),
  roteirosAbordagem: z
    .array(
      z.object({
        situacao: z.string().describe('Quando usar este roteiro (ex.: visita a feira)'),
        roteiro: z.string().describe('Roteiro/script que o humano usa na abordagem'),
      }),
    )
    .describe('Roteiros de abordagem que o dono usa pessoalmente'),
  avisosConformidade: z
    .array(z.string())
    .describe('Avisos LGPD/CDC: sem contatos pessoais, sem outreach automatizado'),
});
export type ProspectingPlan = z.infer<typeof ProspectingPlanSchema>;

/** Conteúdo persistido na coluna jsonb de `deliverables`. */
export type DeliverableContent =
  | ({ tipo: 'plano-conteudo' } & ContentPlan)
  | ({ tipo: 'pesquisa-mercado' } & MarketResearch)
  | ({ tipo: 'plano-prospeccao' } & ProspectingPlan)
  | { tipo: 'texto'; texto: string };
