import { desc, eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { getDb } from '@/src/db';
import { artifacts, type ArtifactCategoria } from '@/src/db/schema';
import { criarArtefato } from '@/src/lib/artifacts';

export const dynamic = 'force-dynamic';

const CATEGORIAS: ArtifactCategoria[] = [
  'nota',
  'pesquisa',
  'decisao',
  'referencia',
];

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

/**
 * POST /api/artifacts
 *
 * Cria um artefato manualmente (autor = usuário). Corpo:
 * { titulo, categoria, conteudo, tags? }.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  const body = (await req.json()) as {
    titulo?: string;
    categoria?: string;
    conteudo?: string;
    tags?: string[];
  };

  const titulo = (body.titulo ?? '').trim();
  const conteudo = (body.conteudo ?? '').trim();
  if (!titulo) return new Response('Título obrigatório', { status: 400 });

  const categoria = (
    CATEGORIAS.includes(body.categoria as ArtifactCategoria)
      ? body.categoria
      : 'nota'
  ) as ArtifactCategoria;

  const row = await criarArtefato({
    businessId: business.id,
    autor: 'usuario',
    titulo,
    categoria,
    conteudo,
    tags: Array.isArray(body.tags) ? body.tags : [],
  });

  return Response.json({ artefato: row }, { status: 201 });
}
