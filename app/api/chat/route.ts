import { auth } from '@clerk/nextjs/server';
import { createAgentUIStreamResponse } from 'ai';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getCeoAgent } from '@/src/agents/ceo/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/chat
 *
 * Rota de conversa com o CEO. Recebe o histórico de UIMessage[] enviado pelo
 * `useChat` do cliente e devolve um stream de UI Messages do agente.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);

  const { messages } = await req.json();

  const agent = getCeoAgent({ ownerUserId: userId, businessId: business.id });

  return createAgentUIStreamResponse({ agent, uiMessages: messages });
}
