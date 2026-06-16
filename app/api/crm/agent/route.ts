import { auth } from '@clerk/nextjs/server';
import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { getOrCreateBusiness } from '@/src/lib/business';
import { garantirCrmInicial } from '@/src/lib/crm';
import { getCrmAgent } from '@/src/agents/crm/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/crm/agent
 *
 * Chat com o agente CRM. Ele configura e opera o CRM (funis, pontos, campos,
 * contatos e cards) via tools que refletem na hora no banco. Nesta versão o
 * histórico não é persistido no servidor — o cliente mantém as mensagens e o
 * estado "de verdade" vive no próprio CRM (consultado a cada resposta).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  // Garante um funil inicial para o agente ter sobre o que falar/operar.
  await garantirCrmInicial(business.id);

  const body = (await req.json()) as { messages: UIMessage[] };
  const messages = body.messages ?? [];

  const agent = getCrmAgent({ businessId: business.id });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
