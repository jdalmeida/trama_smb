import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { RascunharSchema } from '@/src/domain/channels';
import { rascunharResposta } from '@/src/lib/channel-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/channels/conversations/[id]/draft — gera, com IA, uma sugestão de
 * resposta para a conversa (Perfil do Negócio + histórico recente). A IA só
 * rascunha; o dono revisa, edita e envia. `instrucao` (opcional) orienta o tom.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const { id } = await params;
    const { instrucao } = RascunharSchema.parse(await req.json().catch(() => ({})));
    const rascunho = await rascunharResposta(businessId, id, instrucao);
    return Response.json({ rascunho });
  } catch (err) {
    return falha(err);
  }
}
