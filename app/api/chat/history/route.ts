import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { listarMensagens } from '@/src/lib/chat-history';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/history
 *
 * Devolve o histórico do chat com o CEO ({ mensagens: UIMessage[] }) em ordem
 * cronológica, para a UI hidratar o useChat após um refresh da página.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);
  const mensagens = await listarMensagens(business.id);

  return Response.json({ mensagens });
}
