import { z } from 'zod';
import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { upsertConexao } from '@/src/lib/channels';
import { assinarAppNaWaba, verificarNumeroWhatsApp } from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

const Body = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  nome: z.string().max(120).optional(),
});

/**
 * POST /api/channels/whatsapp/connect — conexão DIRETA do WhatsApp (Cloud API
 * clássica, sem Embedded Signup). Para o dono ligar o próprio número usando
 * phone_number_id + waba_id + um token (System User), pegos no painel da Meta
 * (WhatsApp → Configuração da API). Valida o número, assina o app na WABA para
 * receber os webhooks e salva a conexão.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const { phoneNumberId, wabaId, accessToken, nome } = Body.parse(await req.json());

    // Valida o par número+token e descobre o nome de exibição.
    const info = await verificarNumeroWhatsApp(phoneNumberId, accessToken);
    // Assina o app na WABA (os webhooks de mensagens passam a chegar).
    await assinarAppNaWaba(wabaId, accessToken);

    const conexao = await upsertConexao(businessId, {
      platform: 'whatsapp',
      externalId: phoneNumberId,
      nomeExibicao:
        nome?.trim() || info.verifiedName || info.displayPhoneNumber || 'WhatsApp',
      accessToken,
      meta: { wabaId, phoneNumberId, coexistence: false },
      simulada: false,
    });
    return Response.json({ conexao }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
