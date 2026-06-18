import { normalizarWebhook } from '@/src/domain/channels';
import { aplicarContatos, ingestMensagem } from '@/src/lib/channels';
import { dispararAtendimentoAutopilot } from '@/src/lib/autopilot-trigger';
import { verificarAssinatura, webhookVerifyToken } from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

/**
 * Webhook da Meta (rota PÚBLICA — ver proxy.ts). A Meta chama sem sessão de
 * usuário, então o roteamento ao negócio é feito pelo id externo da conta
 * (resolvido em ingestMensagem).
 *
 * GET  — verificação de inscrição: devolve hub.challenge se o verify token bate.
 * POST — entrega de eventos: valida assinatura, normaliza e persiste.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const esperado = webhookVerifyToken();
  if (mode === 'subscribe' && esperado && token === esperado && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  // Corpo cru: necessário para conferir a assinatura HMAC byte a byte.
  const raw = await req.text();
  const assinatura = req.headers.get('x-hub-signature-256');
  if (!verificarAssinatura(raw, assinatura)) {
    return new Response('Assinatura inválida', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Corpo inválido: 200 mesmo assim para a Meta não reenfileirar.
    return Response.json({ ok: true });
  }

  const { mensagens, contatos } = normalizarWebhook(payload);
  console.log('[webhook/meta] recebido', {
    object: (payload as { object?: string })?.object ?? null,
    mensagens: mensagens.length,
    contatos: contatos.length,
  });
  // Processa em sequência; falhas individuais não derrubam o lote.
  // Conversas com piloto ligado que receberam entrada ao vivo: acionamos o
  // agente UMA vez por conversa, após ingerir tudo (várias mensagens no mesmo
  // lote não disparam respostas repetidas).
  const autopilot = new Map<string, string>();
  for (const m of mensagens) {
    try {
      const r = await ingestMensagem(m);
      if (r?.autopilotPendente) autopilot.set(r.conversationId, r.businessId);
    } catch (err) {
      console.error('[webhook/meta] falha ao ingerir mensagem', {
        platform: m.platform,
        connectionExternalId: m.connectionExternalId,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  for (const [conversationId, businessId] of autopilot) {
    await dispararAtendimentoAutopilot(businessId, conversationId);
  }
  // Coexistência: sincroniza nomes de contatos vindos do app (smb_app_state_sync).
  if (contatos.length > 0) {
    try {
      await aplicarContatos(contatos);
    } catch {
      // não bloqueia a resposta
    }
  }

  // A Meta exige 200 rápido; reentregas são tratadas por dedupe no ingest.
  return Response.json({ ok: true });
}
