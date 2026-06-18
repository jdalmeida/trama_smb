import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { AtualizarPostSchema } from '@/src/domain/social-posts';
import { atualizarPost, descartarPost } from '@/src/lib/social-posts';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/channels/posts/[id] — edita um rascunho (legenda, imagem, redes-alvo). */
export async function PATCH(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();
  try {
    const { id } = await params;
    const patch = AtualizarPostSchema.parse(await req.json());
    const post = await atualizarPost(businessId, id, patch);
    if (!post) return falha(new Error('Publicação não encontrada.'), 404);
    return Response.json({ ok: true, post });
  } catch (err) {
    return falha(err);
  }
}

/** DELETE /api/channels/posts/[id] — descarta (apaga) um rascunho. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();
  const { id } = await params;
  await descartarPost(businessId, id);
  return Response.json({ ok: true });
}
