import { auth } from '@clerk/nextjs/server';
import {
  createAgentUIStreamResponse,
  type InferAgentUIMessage,
  type UIMessage,
} from 'ai';
import { getOrCreateBusiness } from '@/src/lib/business';
import { salvarMensagens } from '@/src/lib/chat-history';
import { getCeoAgent } from '@/src/agents/ceo/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/chat
 *
 * Rota de conversa com o CEO. Recebe o histórico de UIMessage[] enviado pelo
 * `useChat` do cliente e devolve um stream de UI Messages do agente.
 * Persiste no banco a última mensagem do usuário e, via onFinish, a resposta
 * do assistente (upsert por id — reenvios do histórico não duplicam).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Persiste apenas o que é novo: a última mensagem do usuário.
  const ultima = messages.at(-1);
  if (ultima && ultima.role === 'user') {
    await salvarMensagens(business.id, [ultima]);
  }

  const agent = getCeoAgent({ ownerUserId: userId, businessId: business.id });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    // Modo persistência: garante id estável na mensagem de resposta.
    originalMessages: messages as InferAgentUIMessage<typeof agent>[],
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;
      await salvarMensagens(business.id, [responseMessage as UIMessage]);
    },
  });
}
