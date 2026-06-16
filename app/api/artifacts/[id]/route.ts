import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import {
  apagarArtefato,
  atualizarArtefato,
  lerArtefato,
} from '@/src/lib/artifacts';
import type { ArtifactCategoria } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const CATEGORIAS: ArtifactCategoria[] = [
  'nota',
  'pesquisa',
  'decisao',
  'referencia',
];

/** PATCH /api/artifacts/[id] — edita título/categoria/conteúdo/tags. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const body = (await req.json()) as {
    titulo?: string;
    categoria?: string;
    conteudo?: string;
    tags?: string[];
  };

  const patch: {
    titulo?: string;
    categoria?: ArtifactCategoria;
    conteudo?: string;
    tags?: string[];
  } = {};
  if (typeof body.titulo === 'string') patch.titulo = body.titulo.trim();
  if (typeof body.conteudo === 'string') patch.conteudo = body.conteudo;
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (CATEGORIAS.includes(body.categoria as ArtifactCategoria)) {
    patch.categoria = body.categoria as ArtifactCategoria;
  }

  const row = await atualizarArtefato(business.id, id, patch);
  if (!row) return new Response('Artefato não encontrado', { status: 404 });
  return Response.json({ artefato: row });
}

/** DELETE /api/artifacts/[id] — apaga o artefato. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const existente = await lerArtefato(business.id, id);
  if (!existente) return new Response('Artefato não encontrado', { status: 404 });

  await apagarArtefato(business.id, id);
  return Response.json({ ok: true });
}
