import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { AutopilotToggleSchema } from '@/src/domain/channel-autopilot';
import { definirAutopilot } from '@/src/lib/channel-autopilot';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/channels/conversations/[id]/autopilot — liga/desliga o piloto
 * automático de uma conversa (e grava a diretriz opcional do dono).
 *
 * Guardrail: só pode ser LIGADO numa conversa onde o dono já enviou ao menos uma
 * mensagem (o contato é sempre iniciado por ele). A lib lança erro → 400.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const { id } = await params;
    const { ativo, instrucao } = AutopilotToggleSchema.parse(await req.json());
    const estado = await definirAutopilot(businessId, id, ativo, instrucao);
    return Response.json({ ok: true, autopilot: estado });
  } catch (err) {
    return falha(err);
  }
}
