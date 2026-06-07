import { z } from 'zod';

/**
 * Perfil do Negócio — o artefato estruturado que o CEO extrai no onboarding
 * e persiste no banco (coluna jsonb). É a base de contexto para as personas.
 */
export const BusinessProfileSchema = z.object({
  nomeNegocio: z.string().describe('Nome do negócio'),
  setor: z.string().describe('Setor / ramo de atuação'),
  produtoServico: z.string().describe('Principal produto ou serviço oferecido'),
  publicoAlvo: z.string().describe('Quem é o cliente ideal (perfil, dores, contexto)'),
  regiao: z.string().describe('Região / cidade de atuação').optional(),
  canaisAtuais: z
    .array(z.string())
    .describe('Canais usados hoje para atrair/atender clientes')
    .default([]),
  principaisDores: z
    .array(z.string())
    .describe('Principais dores e desafios do negócio')
    .default([]),
  diferenciais: z
    .array(z.string())
    .describe('Diferenciais competitivos percebidos')
    .default([]),
  ticketMedio: z.string().describe('Ticket médio aproximado').optional(),
  objetivos: z
    .array(z.string())
    .describe('Objetivos de negócio nos próximos meses')
    .default([]),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/** Versão "parcial" usada durante o onboarding, antes do perfil estar completo. */
export const PartialBusinessProfileSchema = BusinessProfileSchema.partial();
export type PartialBusinessProfile = z.infer<typeof PartialBusinessProfileSchema>;
