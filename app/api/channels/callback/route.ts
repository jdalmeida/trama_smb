import { negocioAtual } from '@/src/lib/api';
import { salvarContasDescobertas } from '@/src/lib/channels';
import {
  descobrirContas,
  redirectUri,
  trocarCodePorToken,
  verificarState,
} from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels/callback — retorno do OAuth da Meta.
 *
 * Valida o `state` assinado, troca o `code` por um token de longa duração,
 * descobre as contas (Páginas/IG/WABA) e cria as conexões. Sempre redireciona
 * de volta para o console com um parâmetro de status (a UI mostra o toast).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const destino = (status: string, extra = '') =>
    Response.redirect(`${url.origin}/console?canais=${status}${extra}`, 302);

  const erro = url.searchParams.get('error');
  if (erro) return destino('erro');

  const state = verificarState(url.searchParams.get('state'));
  const code = url.searchParams.get('code');
  if (!state || !code) return destino('erro');

  // Confere que quem voltou é o mesmo negócio que iniciou o fluxo.
  const businessId = await negocioAtual();
  if (!businessId || businessId !== state.businessId) return destino('erro');

  try {
    const { token, expiraEm } = await trocarCodePorToken(code, redirectUri(req));
    const contas = await descobrirContas(token);
    const n = await salvarContasDescobertas(businessId, contas, expiraEm);
    return destino(n > 0 ? 'conectado' : 'vazio', `&n=${n}`);
  } catch {
    return destino('erro');
  }
}
