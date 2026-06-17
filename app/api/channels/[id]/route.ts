import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { desconectar } from '@/src/lib/channels';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/channels/[id] — desconecta uma conta (apaga conexão + conversas). */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await desconectar(businessId, id);
  return Response.json({ ok: true });
}
