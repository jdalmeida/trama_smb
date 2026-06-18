import { z } from 'zod';

/**
 * Domínio das publicações sociais (posts no feed do Facebook e do Instagram).
 *
 * Diferente do inbox (DMs), aqui o que vai para a rede é um POST público. O
 * fluxo é de APROVAÇÃO: a persona de Conteúdo & Aquisição (ou o dono) rascunha
 * um post; ele entra na fila como `rascunho` e só é publicado quando o dono
 * revisa, escolhe as redes e aprova. A IA nunca publica sozinha — coerente com
 * o guardrail das levas anteriores.
 *
 * A publicação reusa as `channel_connections` existentes: a conexão de
 * plataforma `messenger` representa a Página do Facebook (page_id + token) e a
 * `instagram` a conta profissional vinculada (ig_id). Por isso os ALVOS de um
 * post são `facebook`/`instagram` (não o enum de plataformas de mensageria).
 */

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

/** Redes onde um post pode ser publicado. */
export const SOCIAL_POST_TARGETS = ['facebook', 'instagram'] as const;
export type SocialPostTarget = (typeof SOCIAL_POST_TARGETS)[number];

export const SOCIAL_POST_TARGET_LABELS: Record<SocialPostTarget, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

/**
 * A conexão de mensageria que dá o token/ids para publicar em cada rede:
 *  - Facebook  → conexão `messenger` (a Página: page_id + page access token);
 *  - Instagram → conexão `instagram` (conta profissional: ig_id + page token).
 */
export const TARGET_TO_CONNECTION_PLATFORM = {
  facebook: 'messenger',
  instagram: 'instagram',
} as const;

/** Estado do post no fluxo de aprovação/publicação. */
export const SOCIAL_POST_STATUSES = [
  'rascunho',
  'publicando',
  'publicado',
  'falha',
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

/** De onde veio o rascunho. `ia_sugestao` = sugerido pela persona de conteúdo. */
export const SOCIAL_POST_ORIGINS = ['manual', 'ia_rascunho', 'ia_sugestao'] as const;
export type SocialPostOrigin = (typeof SOCIAL_POST_ORIGINS)[number];

/* ------------------------------------------------------------------ *
 * Resultado de publicação (por rede) e DTO
 * ------------------------------------------------------------------ */

/** Resultado da tentativa de publicar numa rede (gravado em `resultados`). */
export interface SocialPostResult {
  target: SocialPostTarget;
  ok: boolean;
  /** Id do post/mídia na plataforma, quando publicado. */
  externalPostId?: string;
  /** Link público do post, quando a plataforma o devolve. */
  permalink?: string;
  /** Mensagem de erro, quando a publicação falhou nessa rede. */
  erro?: string;
}

/** O que a API devolve para a UI (datas como ISO string). */
export interface SocialPostDTO {
  id: string;
  status: SocialPostStatus;
  origem: SocialPostOrigin;
  /** Legenda/copy do post. */
  texto: string;
  /** URL pública da imagem (obrigatória para publicar no Instagram). */
  imageUrl: string | null;
  /** Redes-alvo escolhidas pelo dono. */
  alvos: SocialPostTarget[];
  /** Resultado por rede após publicar. */
  resultados: SocialPostResult[];
  /** Canal sugerido pela IA (ex.: "Instagram") — só orientação. */
  canalSugerido: string | null;
  publicadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/* ------------------------------------------------------------------ *
 * Schemas (validação nas rotas)
 * ------------------------------------------------------------------ */

const TargetSchema = z.enum(SOCIAL_POST_TARGETS);

/** Cria um rascunho de post (manual no composer ou via persona/entregável). */
export const CriarPostSchema = z.object({
  texto: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
  alvos: z.array(TargetSchema).max(2).optional().default([]),
  canalSugerido: z.string().max(60).optional(),
  origem: z.enum(SOCIAL_POST_ORIGINS).optional(),
});
export type CriarPostInput = z.infer<typeof CriarPostSchema>;

/** Edita um rascunho: legenda, imagem (null remove) e/ou redes-alvo. */
export const AtualizarPostSchema = z
  .object({
    texto: z.string().min(1).max(5000).optional(),
    imageUrl: z.string().url().nullable().optional(),
    alvos: z.array(TargetSchema).max(2).optional(),
  })
  .refine((v) => v.texto !== undefined || v.imageUrl !== undefined || v.alvos !== undefined, {
    message: 'Nada para atualizar.',
  });
export type AtualizarPostInput = z.infer<typeof AtualizarPostSchema>;

/** Aprova e publica: o dono confirma as redes-alvo no momento da publicação. */
export const PublicarPostSchema = z.object({
  alvos: z.array(TargetSchema).min(1).max(2),
});
export type PublicarPostInput = z.infer<typeof PublicarPostSchema>;
