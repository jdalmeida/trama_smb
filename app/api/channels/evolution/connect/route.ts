import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { upsertConexao } from '@/src/lib/channels';
import {
  conectarInstancia,
  criarInstancia,
  evolutionConfigurado,
  evolutionWebhookToken,
  instanceNameDe,
} from '@/src/lib/evolution';

export const dynamic = 'force-dynamic';

/**
 * POST /api/channels/evolution/connect — inicia a conexão via Evolution API
 * (WhatsApp não-oficial, QR). Cria/garante a instância apontando o webhook para
 * o Trama, registra a conexão (status 'conectado' só de fato após parear) e
 * devolve o QR (base64) para a UI exibir. O dono escaneia com o WhatsApp.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  if (!evolutionConfigurado()) {
    return falha(
      new Error(
        'Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY (veja docs/omnichannel-setup.md).',
      ),
    );
  }

  try {
    const instanceName = instanceNameDe(businessId);
    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/channels/evolution/webhook?token=${encodeURIComponent(
      evolutionWebhookToken(),
    )}`;

    await criarInstancia(instanceName, webhookUrl);
    const qr = await conectarInstancia(instanceName);

    // Registra a conexão (externalId = nome da instância → roteia o webhook).
    await upsertConexao(businessId, {
      platform: 'whatsapp',
      externalId: instanceName,
      nomeExibicao: 'WhatsApp (Evolution)',
      meta: { provider: 'evolution', instanceName, coexistence: true },
      simulada: false,
    });

    return Response.json({ qr });
  } catch (err) {
    return falha(err);
  }
}
