import { auth } from '@clerk/nextjs/server';
import {
  createAgentUIStreamResponse,
  type InferAgentUIMessage,
  type UIMessage,
} from 'ai';
import { getOrCreateBusiness } from '@/src/lib/business';
import { salvarMensagens } from '@/src/lib/chat-history';
import {
  criarConversa,
  getConversa,
  tocarConversa,
} from '@/src/lib/conversations';
import { getCeoAgent } from '@/src/agents/ceo/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Extrai o texto puro de uma UIMessage (concatena as parts de texto). */
function textoDe(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join(' ')
    .trim();
}

/**
 * POST /api/chat
 *
 * Conversa com o CEO, escopada a UMA conversa (conversationId no corpo). Recebe
 * o histórico de UIMessage[] do `useChat` e devolve um stream de UI Messages.
 *
 * Persistência (corrige o bug de respostas do agente sumindo): a última
 * mensagem do usuário é gravada na hora; a resposta do assistente é gravada no
 * onFinish — que o AI SDK AGUARDA no flush do stream antes de fechá-lo, então a
 * função fica viva até a escrita concluir (local e no Vercel Fluid). Erros são
 * logados em vez de silenciados, para que falhas de persistência apareçam.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);

  const body = (await req.json()) as {
    messages: UIMessage[];
    conversationId?: string;
  };
  const messages = body.messages ?? [];

  // Resolve a conversa: usa a enviada (validando tenancy) ou cria uma nova.
  let conversationId = body.conversationId;
  if (conversationId) {
    const conversa = await getConversa(business.id, conversationId);
    if (!conversa) conversationId = undefined;
  }
  if (!conversationId) {
    const nova = await criarConversa(business.id);
    conversationId = nova.id;
  }
  const convId = conversationId;

  // Persiste já a última mensagem do usuário e titula a conversa na 1ª vez.
  const ultima = messages.at(-1);
  if (ultima && ultima.role === 'user') {
    await salvarMensagens(business.id, convId, [ultima]);
    await tocarConversa(business.id, convId, textoDe(ultima));
  }

  const agent = getCeoAgent({ ownerUserId: userId, businessId: business.id });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    // Modo persistência: garante id estável na mensagem de resposta.
    originalMessages: messages as InferAgentUIMessage<typeof agent>[],
    // Expõe o id da conversa ao cliente (ele guarda para os próximos envios).
    headers: { 'x-conversation-id': convId },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;
      try {
        await salvarMensagens(business.id, convId, [
          responseMessage as UIMessage,
        ]);
      } catch (err) {
        console.error('[chat] falha ao salvar resposta do agente', err);
      }
    },
  });
}
