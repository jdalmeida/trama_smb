import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { lerConversaComMensagens, marcarLida } from '@/src/lib/channels';
import { listarSinais } from '@/src/lib/channel-autopilot';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/channels/conversations/[id] — uma conversa com suas mensagens e os
 * sinais que o piloto automático detectou (e o que o CEO fez a respeito).
 * Marca a conversa como lida (zera o badge de não lidas) ao abrir.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  const data = await lerConversaComMensagens(businessId, id);
  if (!data) return new Response('Conversa não encontrada', { status: 404 });

  const sinais = await listarSinais(businessId, id);
  await marcarLida(businessId, id);
  return Response.json({ ...data, sinais });
}
