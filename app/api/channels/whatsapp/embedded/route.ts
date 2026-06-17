import { z } from 'zod';
import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { upsertConexao } from '@/src/lib/channels';
import {
  assinarAppNaWaba,
  trocarCodeEmbedded,
  verificarNumeroWhatsApp,
} from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

const Body = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
});

/**
 * POST /api/channels/whatsapp/embedded — conclui o Embedded Signup do WhatsApp
 * (fluxo JS / coexistência). O front captura `phone_number_id` e `waba_id` do
 * evento WA_EMBEDDED_SIGNUP e o `code` do FB.login. Aqui trocamos o code por um
 * token de integração, assinamos o app na WABA e salvamos a conexão marcada
 * como coexistência.
 */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const { code, phoneNumberId, wabaId } = Body.parse(await req.json());

    const token = await trocarCodeEmbedded(code);
    const info = await verificarNumeroWhatsApp(phoneNumberId, token);
    await assinarAppNaWaba(wabaId, token);

    const conexao = await upsertConexao(businessId, {
      platform: 'whatsapp',
      externalId: phoneNumberId,
      nomeExibicao: info.verifiedName || info.displayPhoneNumber || 'WhatsApp',
      accessToken: token,
      meta: { wabaId, phoneNumberId, coexistence: true },
      simulada: false,
    });
    return Response.json({ conexao }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
