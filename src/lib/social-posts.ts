import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { channelConnections, socialPosts } from '@/src/db/schema';
import {
  type CriarPostInput,
  type SocialPostDTO,
  type SocialPostResult,
  type SocialPostTarget,
  TARGET_TO_CONNECTION_PLATFORM,
} from '@/src/domain/social-posts';
import { publicarPostFacebook, publicarPostInstagram } from '@/src/lib/meta';

/**
 * Repositório das publicações sociais (posts) — CRUD e publicação escopados por
 * businessId. Espelha o estilo de src/lib/channels.ts.
 *
 * Fluxo de aprovação (o pedido do dono): um post nasce como `rascunho` (escrito
 * pela persona de Conteúdo & Aquisição ou manualmente) e só vai para a rede
 * quando o dono chama `publicarPost` — a IA nunca publica sozinha.
 *
 * A publicação reusa as channel_connections: `facebook` → conexão `messenger`
 * (a Página) e `instagram` → conexão `instagram` (conta profissional). Conexões
 * de teste (simuladas) apenas registram, sem chamada externa.
 */

type Row = typeof socialPosts.$inferSelect;
type ConnectionRow = typeof channelConnections.$inferSelect;

function toDTO(r: Row): SocialPostDTO {
  return {
    id: r.id,
    status: r.status,
    origem: r.origem,
    texto: r.texto,
    imageUrl: r.imageUrl,
    alvos: r.alvos,
    resultados: r.resultados,
    canalSugerido: r.canalSugerido,
    publicadoEm: r.publicadoEm ? r.publicadoEm.toISOString() : null,
    criadoEm: r.createdAt.toISOString(),
    atualizadoEm: r.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * CRUD
 * ------------------------------------------------------------------ */

export async function listarPosts(businessId: string): Promise<SocialPostDTO[]> {
  const rows = await getDb()
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.businessId, businessId))
    .orderBy(desc(socialPosts.createdAt));
  return rows.map(toDTO);
}

/** Cria um rascunho de post (manual, ou vindo da persona/entregável). */
export async function criarPost(
  businessId: string,
  input: CriarPostInput & { meta?: Record<string, unknown> },
): Promise<SocialPostDTO> {
  const [row] = await getDb()
    .insert(socialPosts)
    .values({
      businessId,
      texto: input.texto,
      imageUrl: input.imageUrl ?? null,
      alvos: input.alvos ?? [],
      canalSugerido: input.canalSugerido ?? null,
      origem: input.origem ?? 'manual',
      meta: input.meta ?? {},
    })
    .returning();
  return toDTO(row);
}

/** Edita um rascunho (legenda, imagem, redes-alvo). Não mexe em posts já publicados. */
export async function atualizarPost(
  businessId: string,
  postId: string,
  patch: { texto?: string; imageUrl?: string | null; alvos?: SocialPostTarget[] },
): Promise<SocialPostDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.texto !== undefined) campos.texto = patch.texto;
  if (patch.imageUrl !== undefined) campos.imageUrl = patch.imageUrl;
  if (patch.alvos !== undefined) campos.alvos = patch.alvos;

  const [row] = await getDb()
    .update(socialPosts)
    .set(campos)
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.businessId, businessId),
      ),
    )
    .returning();
  return row ? toDTO(row) : null;
}

/** Descarta (apaga) um rascunho de post. */
export async function descartarPost(businessId: string, postId: string): Promise<void> {
  await getDb()
    .delete(socialPosts)
    .where(and(eq(socialPosts.id, postId), eq(socialPosts.businessId, businessId)));
}

/* ------------------------------------------------------------------ *
 * Publicação (aprovação do dono → rede)
 * ------------------------------------------------------------------ */

/**
 * Publica um post nas redes escolhidas pelo dono. Resolve a conexão de cada
 * rede (Página do Facebook / conta do Instagram), roteia para a Graph API e
 * grava o resultado por rede. Conexões de teste apenas registram. Cada rede é
 * tentada de forma independente: uma falha numa não impede a outra.
 *
 * Guardrail: só é chamado por uma ação explícita do dono (rota /publish) —
 * a IA apenas rascunha.
 */
export async function publicarPost(
  businessId: string,
  postId: string,
  alvos: SocialPostTarget[],
): Promise<SocialPostDTO> {
  const db = getDb();
  const rows = await db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.id, postId), eq(socialPosts.businessId, businessId)))
    .limit(1);
  const post = rows[0];
  if (!post) throw new Error('Publicação não encontrada.');
  if (post.status === 'publicado') throw new Error('Esta publicação já foi publicada.');
  if (!post.texto.trim() && !post.imageUrl) throw new Error('A publicação está vazia.');
  if (alvos.includes('instagram') && !post.imageUrl) {
    throw new Error('O Instagram exige uma imagem. Anexe uma imagem antes de publicar.');
  }

  // Marca como "publicando" e fixa os alvos escolhidos.
  await db
    .update(socialPosts)
    .set({ status: 'publicando', alvos, updatedAt: new Date() })
    .where(eq(socialPosts.id, postId));

  const resultados: SocialPostResult[] = [];
  for (const target of alvos) {
    try {
      const r = await publicarEm(businessId, target, post.texto, post.imageUrl);
      resultados.push({ target, ok: true, ...r });
    } catch (err) {
      resultados.push({
        target,
        ok: false,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const algumOk = resultados.some((r) => r.ok);
  const [row] = await db
    .update(socialPosts)
    .set({
      status: algumOk ? 'publicado' : 'falha',
      resultados,
      publicadoEm: algumOk ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(socialPosts.id, postId))
    .returning();
  return toDTO(row);
}

/** Publica numa rede específica, resolvendo a conexão e roteando. */
async function publicarEm(
  businessId: string,
  target: SocialPostTarget,
  texto: string,
  imageUrl: string | null,
): Promise<{ externalPostId?: string; permalink?: string }> {
  const conn = await acharConexao(businessId, target);
  if (!conn) {
    throw new Error(
      target === 'facebook'
        ? 'Conecte a Página do Facebook na aba Conexões antes de publicar.'
        : 'Conecte o Instagram na aba Conexões antes de publicar.',
    );
  }

  // Conta de teste: simula a publicação (sem chamada externa).
  if (conn.simulada) {
    return { externalPostId: `sim-${target}-${randomId()}` };
  }
  if (!conn.accessToken) {
    throw new Error('Conexão sem token de acesso. Reconecte a conta.');
  }

  const metaConn = (conn.meta ?? {}) as Record<string, unknown>;
  if (target === 'facebook') {
    const pageId = (typeof metaConn.pageId === 'string' && metaConn.pageId) || conn.externalId;
    const r = await publicarPostFacebook(pageId, conn.accessToken, {
      mensagem: texto,
      imageUrl,
    });
    return { externalPostId: r.externalPostId, permalink: r.permalink ?? undefined };
  }
  // instagram
  if (!imageUrl) throw new Error('O Instagram exige uma imagem.');
  const igId = (typeof metaConn.igId === 'string' && metaConn.igId) || conn.externalId;
  const r = await publicarPostInstagram(igId, conn.accessToken, {
    caption: texto,
    imageUrl,
  });
  return { externalPostId: r.externalPostId, permalink: r.permalink ?? undefined };
}

/**
 * Acha a conexão que dá token/ids para publicar numa rede. Prioriza conexões
 * reais (não simuladas) sobre contas de teste.
 */
async function acharConexao(
  businessId: string,
  target: SocialPostTarget,
): Promise<ConnectionRow | null> {
  const platform = TARGET_TO_CONNECTION_PLATFORM[target];
  const rows = await getDb()
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.businessId, businessId),
        eq(channelConnections.platform, platform),
      ),
    )
    // simulada=false (0) vem antes de true (1); entre iguais, a mais recente.
    .orderBy(asc(channelConnections.simulada), desc(channelConnections.createdAt));
  return rows[0] ?? null;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
