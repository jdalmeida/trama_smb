import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { lerEntregavel } from '@/src/lib/artifacts';

export const dynamic = 'force-dynamic';

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
