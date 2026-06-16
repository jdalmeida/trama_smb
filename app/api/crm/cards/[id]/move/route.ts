import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { moverCard } from '@/src/lib/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/cards/[id]/move — move o card para outro ponto do funil.
 * Body: { stageId, orderedIds? }. Quando `orderedIds` (a ordem final da coluna
 * destino) vem, regrava as posições — usado pelo drag-drop do kanban.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as { stageId?: string; orderedIds?: string[] };
    if (!body.stageId) return falha(new Error('Informe o stageId destino'));
    const card = await moverCard(
      businessId,
      id,
      body.stageId,
      Array.isArray(body.orderedIds) ? body.orderedIds : undefined,
    );
    if (!card) return new Response('Card não encontrado', { status: 404 });
    return Response.json({ card });
  } catch (err) {
    return falha(err);
  }
}
