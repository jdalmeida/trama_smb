import { naoAutenticado, negocioAtual } from '@/src/lib/api';
import { listarConexoes } from '@/src/lib/channels';
import { metaConfigurado } from '@/src/lib/meta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels — conexões do negócio + se a integração Meta está
 * configurada (decide se a UI oferece o OAuth real ou só o modo de simulação).
 */
export async function GET() {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const conexoes = await listarConexoes(businessId);
  return Response.json({ conexoes, configurado: metaConfigurado() });
}
