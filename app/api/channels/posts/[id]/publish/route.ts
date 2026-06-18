import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { PublicarPostSchema } from '@/src/domain/social-posts';
import { publicarPost } from '@/src/lib/social-posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/channels/posts/[id]/publish — aprova e publica o post nas redes
 * escolhidas pelo dono. Ação explícita e manual (a IA apenas rascunha). Cada
 * rede é tentada de forma independente; o resultado por rede vem no DTO.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();
  try {
    const { id } = await params;
    const { alvos } = PublicarPostSchema.parse(await req.json());
    const post = await publicarPost(businessId, id, alvos);
    return Response.json({ ok: true, post });
  } catch (err) {
    return falha(err);
  }
}
