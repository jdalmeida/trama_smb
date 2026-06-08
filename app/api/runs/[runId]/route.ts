import { and, eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { resumeHook } from 'workflow/api';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getDb } from '@/src/db';
import { runs, deliverables } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/[runId]
 *
 * Devolve o status do run e o entregável associado (escopado ao negócio do
 * usuário). Usado pela UI para hidratar o painel "Time" ao abrir um run.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const { runId } = await params;
  const business = await getOrCreateBusiness(userId);
  const db = getDb();

  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.runId, runId), eq(runs.businessId, business.id)))
    .limit(1);

  if (!run) {
    return new Response('Run não encontrado', { status: 404 });
  }

  let deliverable: {
    titulo: string;
    status: (typeof deliverables.$inferSelect)['status'];
    content: (typeof deliverables.$inferSelect)['content'];
  } | null = null;

  if (run.deliverableId) {
    const [row] = await db
      .select()
      .from(deliverables)
      .where(
        and(
          eq(deliverables.id, run.deliverableId),
          eq(deliverables.businessId, business.id),
        ),
      )
      .limit(1);
    if (row) {
      deliverable = {
        titulo: row.titulo,
        status: row.status,
        content: row.content,
      };
    }
  }

  return Response.json({
    status: run.status,
    persona: run.personaId,
    deliverable,
  });
}

/**
 * POST /api/runs/[runId]
 *
 * Aprovação humana (Fase 3): retoma um workflow pausado num hook. O corpo traz
 * { token, data }; reenviamos para o hook via `resumeHook`.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  // Garante que o run pertence ao negócio do usuário antes de retomá-lo.
  const { runId } = await params;
  const business = await getOrCreateBusiness(userId);
  const db = getDb();

  const [run] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.runId, runId), eq(runs.businessId, business.id)))
    .limit(1);

  if (!run) {
    return new Response('Run não encontrado', { status: 404 });
  }

  const { token, data } = await req.json();
  if (typeof token !== 'string' || token.length === 0) {
    return new Response('Token ausente', { status: 400 });
  }

  await resumeHook(token, data);

  return Response.json({ ok: true });
}
