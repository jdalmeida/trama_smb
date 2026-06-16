import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarStage, atualizarStage } from '@/src/lib/crm';
import { CRM_STAGE_TIPOS, type CrmStageTipo } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/crm/stages/[id] — edita nome, cor ou tipo do ponto. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as { nome?: string; cor?: string; tipo?: string };
    const patch: { nome?: string; cor?: string; tipo?: CrmStageTipo } = {};
    if (typeof body.nome === 'string') patch.nome = body.nome.trim();
    if (typeof body.cor === 'string') patch.cor = body.cor;
    if (CRM_STAGE_TIPOS.includes(body.tipo as CrmStageTipo))
      patch.tipo = body.tipo as CrmStageTipo;

    const stage = await atualizarStage(businessId, id, patch);
    if (!stage) return new Response('Ponto não encontrado', { status: 404 });
    return Response.json({ stage });
  } catch (err) {
    return falha(err);
  }
}

/**
 * DELETE /api/crm/stages/[id]?paraStageId=... — apaga o ponto, reatribuindo os
 * cards ao ponto indicado (ou ao primeiro restante). Barra apagar o último.
 */
export async function DELETE(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  const paraStageId = new URL(req.url).searchParams.get('paraStageId') ?? undefined;
  try {
    await apagarStage(businessId, id, paraStageId);
    return Response.json({ ok: true });
  } catch (err) {
    return falha(err);
  }
}
