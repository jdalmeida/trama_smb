import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarField, atualizarField } from '@/src/lib/crm';
import { CRM_FIELD_TYPES, type CrmFieldType } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/crm/fields/[id] — edita rótulo, tipo, opções, obrigatório. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as {
      rotulo?: string;
      tipo?: string;
      opcoes?: string[];
      obrigatorio?: boolean;
    };
    const patch: {
      rotulo?: string;
      tipo?: CrmFieldType;
      opcoes?: string[];
      obrigatorio?: boolean;
    } = {};
    if (typeof body.rotulo === 'string') patch.rotulo = body.rotulo.trim();
    if (CRM_FIELD_TYPES.includes(body.tipo as CrmFieldType))
      patch.tipo = body.tipo as CrmFieldType;
    if (Array.isArray(body.opcoes)) patch.opcoes = body.opcoes;
    if (typeof body.obrigatorio === 'boolean') patch.obrigatorio = body.obrigatorio;

    const field = await atualizarField(businessId, id, patch);
    if (!field) return new Response('Campo não encontrado', { status: 404 });
    return Response.json({ field });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/fields/[id] — remove a definição de campo. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await apagarField(businessId, id);
  return Response.json({ ok: true });
}
