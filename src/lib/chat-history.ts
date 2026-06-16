import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { getDb } from '@/src/db';
import { chatMessages } from '@/src/db/schema';

/**
 * Lista as últimas `limite` mensagens de UMA conversa, em ordem cronológica
 * (mais antiga primeiro) — pronto para hidratar o useChat. Escopado também por
 * businessId para garantir tenancy.
 */
export async function listarMensagens(
  businessId: string,
  conversationId: string,
  limite = 100,
): Promise<UIMessage[]> {
  const db = getDb();
  const rows = await db
    .select({ message: chatMessages.message })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.businessId, businessId),
        eq(chatMessages.conversationId, conversationId),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limite);
  return rows.reverse().map((r) => r.message);
}

/**
 * Salva mensagens em lote dentro de uma conversa. Upsert por id da UIMessage:
 * se a mensagem já existe (reenvio do histórico, continuação da resposta do
 * assistente), a versão antiga é substituída — nada duplica.
 */
export async function salvarMensagens(
  businessId: string,
  conversationId: string,
  mensagens: UIMessage[],
): Promise<void> {
  if (mensagens.length === 0) return;
  const db = getDb();

  const ids = mensagens.map((m) => m.id);
  await db
    .delete(chatMessages)
    .where(
      and(
        eq(chatMessages.businessId, businessId),
        inArray(sql`${chatMessages.message}->>'id'`, ids),
      ),
    );

  // created_at explícito e crescente para preservar a ordem dentro do lote.
  const base = Date.now();
  await db.insert(chatMessages).values(
    mensagens.map((m, i) => ({
      businessId,
      conversationId,
      role: m.role,
      message: m,
      createdAt: new Date(base + i),
    })),
  );
}
