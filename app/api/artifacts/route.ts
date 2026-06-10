import { desc, eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getDb } from '@/src/db';
import { artifacts } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/artifacts
 *
 * Lista os artefatos da "memória da empresa" do negócio do usuário, com o
 * conteúdo completo (a UI renderiza o markdown inteiro — as funções da lib de
 * artifacts devolvem só um trecho). Mais recentes primeiro, limitado a 50.
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
      id: artifacts.id,
      titulo: artifacts.titulo,
      categoria: artifacts.categoria,
      autor: artifacts.autor,
      tags: artifacts.tags,
      conteudo: artifacts.conteudo,
      criadoEm: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.businessId, business.id))
    .orderBy(desc(artifacts.createdAt))
    .limit(50);

  return Response.json({ artefatos: rows });
}
