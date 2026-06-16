import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { listarRuns } from '@/src/lib/crm-automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/automations/runs?pipelineId=...&limit=... — histórico de execução
 * das automações (o que rodou, quando e o resultado). Sem pipelineId, geral.
 */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get('pipelineId') ?? undefined;
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const runs = await listarRuns(businessId, { pipelineId, limit });
  return Response.json({ runs });
}
