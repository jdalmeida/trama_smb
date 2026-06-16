import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { garantirCrmInicial, getBoard } from '@/src/lib/crm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/board?pipelineId=... — o kanban completo de um funil (pipeline,
 * stages, campos de card aplicáveis e cards). Sem pipelineId, usa o primeiro
 * funil do negócio (semeando o inicial se preciso).
 */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const url = new URL(req.url);
  let pipelineId = url.searchParams.get('pipelineId') ?? undefined;

  if (!pipelineId) {
    const inicial = await garantirCrmInicial(businessId);
    pipelineId = inicial.id;
  }

  const board = await getBoard(businessId, pipelineId);
  if (!board) return new Response('Funil não encontrado', { status: 404 });
  return Response.json({ board });
}
