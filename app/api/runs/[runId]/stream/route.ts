import { auth } from '@clerk/nextjs/server';
import { getRun } from 'workflow/api';
import { and, eq } from 'drizzle-orm';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getDb } from '@/src/db';
import { runs } from '@/src/db/schema';
import type { PersonaStatusEvent } from '@/src/domain/persona';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ runId: string }> };

/**
 * GET /api/runs/[runId]/stream?ns=status
 *
 * Faz proxy do stream durável do Workflow para a UI como NDJSON: 1
 * PersonaStatusEvent por linha (contrato combinado com a UI), no namespace
 * "status" por padrão. Cada objeto do stream do run é serializado para JSON e
 * convertido em bytes (o body de uma Response precisa de bytes).
 */
export async function GET(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const { runId } = await params;

  // Escopa o stream ao negócio do usuário: só transmitimos runs próprios.
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

  const ns = new URL(req.url).searchParams.get('ns') ?? 'status';

  const workflowRun = getRun(runId);
  const readable = workflowRun.getReadable<PersonaStatusEvent>({ namespace: ns });

  const encoder = new TextEncoder();
  const transformed = readable.pipeThrough(
    new TransformStream<PersonaStatusEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
      },
    }),
  );

  return new Response(transformed, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
