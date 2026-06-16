import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import {
  apagarAtividade,
  atualizarAtividade,
  concluirAtividade,
} from '@/src/lib/crm-activity';
import { CRM_ACTIVITY_TIPOS, type CrmActivityTipo } from '@/src/domain/crm-activity';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/crm/activities/[id] — edita a atividade. Se o corpo trouxer apenas
 * `concluida`, marca/desmarca como concluída; senão aplica o patch geral.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.concluida === 'boolean' && Object.keys(body).length === 1) {
      const atividade = await concluirAtividade(businessId, id, body.concluida);
      if (!atividade) return new Response('Atividade não encontrada', { status: 404 });
      return Response.json({ atividade });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.titulo === 'string') patch.titulo = body.titulo.trim();
    if (CRM_ACTIVITY_TIPOS.includes(body.tipo as CrmActivityTipo))
      patch.tipo = body.tipo as CrmActivityTipo;
    if (body.descricao === null || typeof body.descricao === 'string')
      patch.descricao = body.descricao;
    if (typeof body.inicioEm === 'string') patch.inicioEm = body.inicioEm;
    if (body.fimEm === null || typeof body.fimEm === 'string') patch.fimEm = body.fimEm;
    if (typeof body.diaInteiro === 'boolean') patch.diaInteiro = body.diaInteiro;
    if (body.cardId === null || typeof body.cardId === 'string')
      patch.cardId = body.cardId;
    if (body.contatoId === null || typeof body.contatoId === 'string')
      patch.contatoId = body.contatoId;

    const atividade = await atualizarAtividade(businessId, id, patch);
    if (!atividade) return new Response('Atividade não encontrada', { status: 404 });
    return Response.json({ atividade });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/activities/[id] — apaga a atividade. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  await apagarAtividade(businessId, id);
  return Response.json({ ok: true });
}
