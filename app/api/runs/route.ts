import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getDb } from '@/src/db';
import { runs } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runs
 *
 * Lista os runs (durables) do negócio do usuário. Serve para a UI reconectar
 * aos streams de status após um refresh: para cada run devolvemos personaId,
 * runId, deliverableId e status.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);
  const db = getDb();

  const rows = await db
    .select({
      id: runs.id,
      personaId: runs.personaId,
      runId: runs.runId,
      deliverableId: runs.deliverableId,
      status: runs.status,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .where(eq(runs.businessId, business.id));

  return Response.json({ runs: rows });
}
