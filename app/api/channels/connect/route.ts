import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { ChannelPlatformSchema } from '@/src/domain/channels';
import {
  assinarState,
  metaConfigurado,
  redirectUri,
  urlAutorizacao,
} from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels/connect?platform=whatsapp|instagram|messenger
 *
 * Inicia o Facebook Login for Business: redireciona o dono para a Meta com um
 * `state` assinado (CSRF + businessId). Se a integração não está configurada,
 * responde 400 amigável (a UI então oferece o modo de simulação).
 */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  if (!metaConfigurado()) {
    return falha(
      new Error(
        'Integração Meta ainda não configurada. Use uma conta de teste ou configure as credenciais (veja docs/omnichannel-setup.md).',
      ),
    );
  }

  try {
    const platform = ChannelPlatformSchema.parse(
      new URL(req.url).searchParams.get('platform') ?? 'whatsapp',
    );
    const state = assinarState(businessId, platform);
    const url = urlAutorizacao(state, redirectUri(req));
    return Response.redirect(url, 302);
  } catch (err) {
    return falha(err);
  }
}
