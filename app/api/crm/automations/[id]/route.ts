import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarAutomacao, atualizarAutomacao } from '@/src/lib/crm-automation';
import {
  CrmAcaoSchema,
  CrmCondicaoSchema,
  type CrmAcao,
  type CrmCondicao,
} from '@/src/domain/crm-automation';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/crm/automations/[id] — edita nome, ativação, condições, ações. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as {
      nome?: string;
      enabled?: boolean;
      condicoes?: unknown;
      acoes?: unknown;
      triggerStageId?: string | null;
    };
    const patch: {
      nome?: string;
      enabled?: boolean;
      condicoes?: CrmCondicao[];
      acoes?: CrmAcao[];
      triggerStageId?: string | null;
    } = {};
    if (typeof body.nome === 'string') patch.nome = body.nome.trim();
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (body.triggerStageId === null || typeof body.triggerStageId === 'string')
      patch.triggerStageId = body.triggerStageId;
    if (body.condicoes !== undefined)
      patch.condicoes = CrmCondicaoSchema.array().parse(body.condicoes);
    if (body.acoes !== undefined)
      patch.acoes = CrmAcaoSchema.array().min(1).parse(body.acoes);

    const automacao = await atualizarAutomacao(businessId, id, patch);
    if (!automacao) return new Response('Automação não encontrada', { status: 404 });
    return Response.json({ automacao });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/automations/[id] — remove a automação. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await apagarAutomacao(businessId, id);
  return Response.json({ ok: true });
}
