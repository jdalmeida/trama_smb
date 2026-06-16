import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { listarEntregaveis } from '@/src/lib/artifacts';

export const dynamic = 'force-dynamic';

/** GET /api/deliverables — lista os entregáveis do negócio (metadados). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  const entregaveis = await listarEntregaveis(business.id, 50);
  return Response.json({ entregaveis });
}
