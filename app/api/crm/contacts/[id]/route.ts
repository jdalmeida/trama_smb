import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarContato, atualizarContato, lerContato } from '@/src/lib/crm';
import type { CrmValores } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/crm/contacts/[id] — lê um contato completo. */
export async function GET(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  const contato = await lerContato(businessId, id);
  if (!contato) return new Response('Contato não encontrado', { status: 404 });
  return Response.json({ contato });
}

/** PATCH /api/crm/contacts/[id] — edita nome e/ou valores. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as { nome?: string; valores?: CrmValores };
    const patch: { nome?: string; valores?: CrmValores } = {};
    if (typeof body.nome === 'string') patch.nome = body.nome.trim();
    if (body.valores && typeof body.valores === 'object') patch.valores = body.valores;

    const contato = await atualizarContato(businessId, id, patch);
    if (!contato) return new Response('Contato não encontrado', { status: 404 });
    return Response.json({ contato });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/contacts/[id] — apaga o contato (cards ficam sem vínculo). */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await apagarContato(businessId, id);
  return Response.json({ ok: true });
}
