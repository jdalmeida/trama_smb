import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { ChannelPlatformSchema, SimularMensagemSchema } from '@/src/domain/channels';
import { garantirConexaoSimulada, simularEntrada } from '@/src/lib/channels';

export const dynamic = 'force-dynamic';

/**
 * POST /api/channels/simulate — modo de simulação (sem Meta real).
 *
 * Dois usos, conforme o corpo:
 *  - { platform } apenas → cria/garante uma CONTA de teste daquela plataforma.
 *  - { platform, de, texto } → injeta uma MENSAGEM de entrada fictícia,
 *    exercitando o mesmo caminho do webhook (normalização → ingest).
 *
 * Permite validar a fundação ponta-a-ponta enquanto não há credenciais Meta.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json().catch(() => ({}));

    // Sem texto: só garante a conexão de teste.
    if (!body || typeof body.texto !== 'string') {
      const platform = ChannelPlatformSchema.parse(body?.platform ?? 'whatsapp');
      const conexao = await garantirConexaoSimulada(businessId, platform);
      return Response.json({ conexao }, { status: 201 });
    }

    const input = SimularMensagemSchema.parse(body);
    const res = await simularEntrada(businessId, input);
    return Response.json({ ok: true, ...res }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
