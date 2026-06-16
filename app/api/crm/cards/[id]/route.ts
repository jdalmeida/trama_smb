import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarCard, atualizarCard, lerCard } from '@/src/lib/crm';
import type { CrmValores } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/crm/cards/[id] — lê um card completo. */
export async function GET(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  const card = await lerCard(businessId, id);
  if (!card) return new Response('Card não encontrado', { status: 404 });
  return Response.json({ card });
}

/** PATCH /api/crm/cards/[id] — edita título, contato vinculado e/ou valores. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as {
      titulo?: string;
      contatoId?: string | null;
      valores?: CrmValores;
    };
    const patch: { titulo?: string; contatoId?: string | null; valores?: CrmValores } = {};
    if (typeof body.titulo === 'string') patch.titulo = body.titulo.trim();
    if (body.contatoId === null || typeof body.contatoId === 'string')
      patch.contatoId = body.contatoId;
    if (body.valores && typeof body.valores === 'object') patch.valores = body.valores;

    const card = await atualizarCard(businessId, id, patch);
    if (!card) return new Response('Card não encontrado', { status: 404 });
    return Response.json({ card });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/cards/[id] — apaga o card. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await apagarCard(businessId, id);
  return Response.json({ ok: true });
}
