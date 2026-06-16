import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarStage, reordenarStages } from '@/src/lib/crm';
import { CrmStageInputSchema } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

/** POST /api/crm/stages — cria um ponto do funil. Body: { pipelineId, ...stage }. */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const pipelineId = String(body?.pipelineId ?? '');
    if (!pipelineId) return falha(new Error('Informe o pipelineId'));
    const parsed = CrmStageInputSchema.parse(body);
    const stage = await criarStage(businessId, pipelineId, parsed);
    return Response.json({ stage }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}

/** PUT /api/crm/stages — reordena os pontos. Body: { pipelineId, orderedIds }. */
export async function PUT(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = (await req.json()) as { pipelineId?: string; orderedIds?: string[] };
    if (!body.pipelineId || !Array.isArray(body.orderedIds)) {
      return falha(new Error('Informe pipelineId e orderedIds'));
    }
    await reordenarStages(businessId, body.pipelineId, body.orderedIds);
    return Response.json({ ok: true });
  } catch (err) {
    return falha(err);
  }
}
