import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { CriarPostSchema } from '@/src/domain/social-posts';
import { criarPost, listarPosts } from '@/src/lib/social-posts';

export const dynamic = 'force-dynamic';

/** GET /api/channels/posts — lista as publicações (rascunhos + publicados) do negócio. */
export async function GET() {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();
  const posts = await listarPosts(businessId);
  return Response.json({ posts });
}

/**
 * POST /api/channels/posts — cria um rascunho de post (composer manual). A
 * geração por IA vem da persona de Conteúdo & Aquisição (tool criarRascunhoPost),
 * não daqui.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();
  try {
    const input = CriarPostSchema.parse(await req.json());
    const post = await criarPost(businessId, { ...input, origem: input.origem ?? 'manual' });
    return Response.json({ ok: true, post }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
