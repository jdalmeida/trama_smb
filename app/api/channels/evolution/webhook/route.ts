import { ingestMensagem } from '@/src/lib/channels';
import { dispararAtendimentoAutopilot } from '@/src/lib/autopilot-trigger';
import { evolutionWebhookToken, normalizarEvolution } from '@/src/lib/evolution';

export const dynamic = 'force-dynamic';

/**
 * POST /api/channels/evolution/webhook — recebe os eventos da Evolution API
 * (rota PÚBLICA, ver proxy.ts). Validada por um token na query (a Evolution o
 * envia porque o cadastramos na URL do webhook). Normaliza e persiste pelo mesmo
 * caminho do resto (ingestMensagem) — o negócio é resolvido pela instância.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (token !== evolutionWebhookToken()) {
    return new Response('Token inválido', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: true });
  }

  const mensagens = normalizarEvolution(payload);
  console.log('[webhook/evolution] recebido', {
    event: (payload as { event?: string })?.event ?? null,
    instance: (payload as { instance?: string })?.instance ?? null,
    mensagens: mensagens.length,
  });
  const autopilot = new Map<string, string>();
  for (const m of mensagens) {
    try {
      const r = await ingestMensagem(m);
      if (r?.autopilotPendente) autopilot.set(r.conversationId, r.businessId);
    } catch (err) {
      console.error('[webhook/evolution] falha ao ingerir mensagem', {
        connectionExternalId: m.connectionExternalId,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  for (const [conversationId, businessId] of autopilot) {
    await dispararAtendimentoAutopilot(businessId, conversationId);
  }

  return Response.json({ ok: true });
}
