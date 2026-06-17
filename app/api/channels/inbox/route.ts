import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { getInbox } from '@/src/lib/channels';

export const dynamic = 'force-dynamic';

/** GET /api/channels/inbox — conversas do negócio (ordenadas) + conexões. */
export async function GET() {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const inbox = await getInbox(businessId);
  return Response.json(inbox);
}
