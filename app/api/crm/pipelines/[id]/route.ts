import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { apagarPipeline, atualizarPipeline, lerPipeline } from '@/src/lib/crm';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/crm/pipelines/[id] — renomeia, edita descrição ou arquiva. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  try {
    const body = (await req.json()) as {
      nome?: string;
      descricao?: string | null;
      arquivado?: boolean;
    };
    const patch: { nome?: string; descricao?: string | null; arquivado?: boolean } = {};
    if (typeof body.nome === 'string') patch.nome = body.nome.trim();
    if (body.descricao === null || typeof body.descricao === 'string')
      patch.descricao = body.descricao;
    if (typeof body.arquivado === 'boolean') patch.arquivado = body.arquivado;

    const pipeline = await atualizarPipeline(businessId, id, patch);
    if (!pipeline) return new Response('Funil não encontrado', { status: 404 });
    return Response.json({ pipeline });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/crm/pipelines/[id] — apaga o funil e todo o seu conteúdo. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const { id } = await params;
  const existente = await lerPipeline(businessId, id);
  if (!existente) return new Response('Funil não encontrado', { status: 404 });

  await apagarPipeline(businessId, id);
  return Response.json({ ok: true });
}
