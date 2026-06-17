import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { EnviarMensagemSchema } from '@/src/domain/channels';
import { enviarMensagem } from '@/src/lib/channels';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/channels/conversations/[id]/send — envia uma mensagem de texto do
 * dono ao interlocutor, roteando pelo provedor da conexão (Evolution, Cloud API
 * ou Send API; conexões de teste apenas registram). Ação manual: o contato é
 * sempre iniciado/conduzido pelo dono (guardrail).
 */
export async function POST(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const { id } = await params;
    const { texto } = EnviarMensagemSchema.parse(await req.json());
    const res = await enviarMensagem(businessId, id, texto.trim());
    return Response.json({ ok: true, ...res }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
