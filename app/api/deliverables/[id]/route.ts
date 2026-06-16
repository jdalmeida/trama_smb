import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { lerEntregavel } from '@/src/lib/artifacts';
import { retomarEntregavel } from '@/src/lib/resume';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/deliverables/[id] — entregável completo (com conteúdo). */
export async function GET(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const row = await lerEntregavel(business.id, id);
  if (!row) return new Response('Entregável não encontrado', { status: 404 });

  return Response.json({
    entregavel: {
      id: row.id,
      titulo: row.titulo,
      personaId: row.personaId,
      status: row.status,
      content: row.content,
      criadoEm: row.createdAt.toISOString(),
    },
  });
}

/**
 * POST /api/deliverables/[id]/resume
 *
 * Retoma uma persona que parou no meio do caminho: checa o status real do
 * workflow e, se não estiver mais rodando, reinicia um run novo para o mesmo
 * entregável (idempotente — pula o que já foi feito).
 */
export async function POST(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const resultado = await retomarEntregavel(business.id, id);

  if (!resultado.ok) {
    const mapa: Record<string, { status: number; erro: string }> = {
      nao_encontrado: { status: 404, erro: 'Entregável não encontrado' },
      em_execucao: {
        status: 409,
        erro: 'A persona ainda está em execução — aguarde antes de retomar.',
      },
      sem_perfil: {
        status: 400,
        erro: 'Perfil do Negócio não preenchido — não há contexto para retomar.',
      },
    };
    const m = mapa[resultado.motivo] ?? { status: 400, erro: 'Não foi possível retomar' };
    return Response.json(
      { ok: false, motivo: resultado.motivo, erro: m.erro },
      { status: m.status },
    );
  }

  return Response.json(resultado);
}
