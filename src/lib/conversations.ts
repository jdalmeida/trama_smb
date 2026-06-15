import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { chatMessages, conversations } from '@/src/db/schema';

/**
 * Conversas com o CEO.
 *
 * O chat deixou de ser um fio único: o usuário cria várias conversas e navega
 * entre elas. Cada conversa carrega só o seu próprio histórico de mensagens
 * (o "contexto necessário"); a memória da empresa segue compartilhada.
 * Tudo escopado por businessId — quem chama resolve o negócio do usuário.
 */

export interface ConversaResumo {
  id: string;
  titulo: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Quantidade de mensagens — útil para a UI distinguir conversas vazias. */
  mensagens: number;
}

/** Lista as conversas do negócio, mais recentes (por atividade) primeiro. */
export async function listarConversas(
  businessId: string,
): Promise<ConversaResumo[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      titulo: conversations.titulo,
      criadoEm: conversations.createdAt,
      atualizadoEm: conversations.updatedAt,
      mensagens: sql<number>`count(${chatMessages.id})`.mapWith(Number),
    })
    .from(conversations)
    .leftJoin(
      chatMessages,
      eq(chatMessages.conversationId, conversations.id),
    )
    .where(eq(conversations.businessId, businessId))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    criadoEm: r.criadoEm.toISOString(),
    atualizadoEm: r.atualizadoEm.toISOString(),
    mensagens: r.mensagens,
  }));
}

/** Cria uma conversa (título opcional — a 1ª mensagem do usuário titula depois). */
export async function criarConversa(businessId: string, titulo?: string) {
  const [row] = await getDb()
    .insert(conversations)
    .values({ businessId, titulo: titulo ?? null })
    .returning();
  return row;
}

/** Lê uma conversa (escopada ao negócio) ou null. */
export async function getConversa(businessId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.businessId, businessId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Renomeia uma conversa. */
export async function renomearConversa(
  businessId: string,
  id: string,
  titulo: string,
) {
  const [row] = await getDb()
    .update(conversations)
    .set({ titulo, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.businessId, businessId)))
    .returning();
  return row ?? null;
}

/** Apaga uma conversa (as mensagens caem por cascade do FK). */
export async function apagarConversa(businessId: string, id: string) {
  await getDb()
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.businessId, businessId)));
}

/**
 * Marca a conversa como ativa agora (sobe na lista) e, se ainda não tiver
 * título, deriva um a partir do texto da 1ª mensagem do usuário.
 */
export async function tocarConversa(
  businessId: string,
  id: string,
  tituloSugerido?: string,
) {
  const patch: { updatedAt: Date; titulo?: string } = { updatedAt: new Date() };
  if (tituloSugerido) {
    const atual = await getConversa(businessId, id);
    if (atual && !atual.titulo) patch.titulo = tituloFrom(tituloSugerido);
  }
  await getDb()
    .update(conversations)
    .set(patch)
    .where(and(eq(conversations.id, id), eq(conversations.businessId, businessId)));
}

/** Encolhe um texto livre num título curto e limpo. */
export function tituloFrom(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= 48) return limpo;
  return `${limpo.slice(0, 47).trimEnd()}…`;
}
