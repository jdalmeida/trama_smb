import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { estadoConexao, instanceNameDe } from '@/src/lib/evolution';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels/evolution/status — estado da instância do negócio, para a UI
 * fazer polling até o pareamento concluir ('open' = conectado).
 */
export async function GET() {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const state = await estadoConexao(instanceNameDe(businessId));
    return Response.json({ state, conectado: state === 'open' });
  } catch (err) {
    return falha(err);
  }
}
