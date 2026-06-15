import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '@/src/db';
import {
  artifacts,
  deliverables,
  type ArtifactAutor,
  type ArtifactCategoria,
} from '@/src/db/schema';
import { fazerSnippet } from '@/src/lib/web';

/**
 * Repositório de artefatos — a "memória da empresa".
 *
 * CRUD usado tanto pelas tools do CEO (rota /api/chat, não-durável) quanto
 * pelos steps dos workflows de persona (app/steps/memoria.ts). Tudo escopado
 * por businessId; quem chama é responsável por resolver o negócio do usuário.
 */

/** Item de listagem/busca: metadados + trecho do conteúdo. */
export interface ArtifactResumo {
  id: string;
  titulo: string;
  categoria: ArtifactCategoria;
  autor: ArtifactAutor;
  tags: string[];
  trecho: string;
  criadoEm: string;
}

export interface CriarArtefatoInput {
  businessId: string;
  autor: ArtifactAutor;
  titulo: string;
  categoria: ArtifactCategoria;
  conteudo: string;
  tags?: string[];
  runId?: string;
}

/** Cria um artefato na memória da empresa. */
export async function criarArtefato(input: CriarArtefatoInput) {
  const [row] = await getDb()
    .insert(artifacts)
    .values({
      businessId: input.businessId,
      autor: input.autor,
      titulo: input.titulo,
      categoria: input.categoria,
      conteudo: input.conteudo,
      tags: input.tags ?? [],
      runId: input.runId,
    })
    .returning();
  return row;
}

/**
 * Busca artefatos por texto (ILIKE em título e conteúdo) e/ou categoria.
 * Sem query, lista os mais recentes. Retorna resumos (com trecho), não o
 * conteúdo inteiro — o agente lê o artefato completo com lerArtefato.
 */
export async function buscarArtefatos(
  businessId: string,
  opts: { query?: string; categoria?: ArtifactCategoria; limit?: number } = {},
): Promise<ArtifactResumo[]> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 8, 20);

  const condicoes = [eq(artifacts.businessId, businessId)];
  if (opts.categoria) condicoes.push(eq(artifacts.categoria, opts.categoria));
  if (opts.query && opts.query.trim().length > 0) {
    const padrao = `%${opts.query.trim()}%`;
    const textual = or(
      ilike(artifacts.titulo, padrao),
      ilike(artifacts.conteudo, padrao),
    );
    if (textual) condicoes.push(textual);
  }

  const rows = await db
    .select()
    .from(artifacts)
    .where(and(...condicoes))
    .orderBy(desc(artifacts.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria,
    autor: r.autor,
    tags: r.tags,
    trecho: fazerSnippet(r.conteudo),
    criadoEm: r.createdAt.toISOString(),
  }));
}

/** Campos editáveis de um artefato. */
export interface AtualizarArtefatoInput {
  titulo?: string;
  categoria?: ArtifactCategoria;
  conteudo?: string;
  tags?: string[];
}

/** Atualiza um artefato (escopado ao negócio). Retorna a linha ou null. */
export async function atualizarArtefato(
  businessId: string,
  artifactId: string,
  patch: AtualizarArtefatoInput,
) {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.titulo !== undefined) campos.titulo = patch.titulo;
  if (patch.categoria !== undefined) campos.categoria = patch.categoria;
  if (patch.conteudo !== undefined) campos.conteudo = patch.conteudo;
  if (patch.tags !== undefined) campos.tags = patch.tags;

  const [row] = await getDb()
    .update(artifacts)
    .set(campos)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.businessId, businessId)))
    .returning();
  return row ?? null;
}

/** Apaga um artefato (escopado ao negócio). */
export async function apagarArtefato(businessId: string, artifactId: string) {
  await getDb()
    .delete(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.businessId, businessId)));
}

/** Lê um artefato completo (escopado ao negócio) ou null. */
export async function lerArtefato(businessId: string, artifactId: string) {
  const rows = await getDb()
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.businessId, businessId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Lista os entregáveis do negócio (metadados, sem o conteúdo). */
export async function listarEntregaveis(businessId: string, limit = 20) {
  const rows = await getDb()
    .select({
      id: deliverables.id,
      titulo: deliverables.titulo,
      personaId: deliverables.personaId,
      status: deliverables.status,
      createdAt: deliverables.createdAt,
    })
    .from(deliverables)
    .where(eq(deliverables.businessId, businessId))
    .orderBy(desc(deliverables.createdAt))
    .limit(Math.min(limit, 50));

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    personaId: r.personaId,
    status: r.status,
    criadoEm: r.createdAt.toISOString(),
  }));
}

/** Lê um entregável completo (escopado ao negócio) ou null. */
export async function lerEntregavel(businessId: string, deliverableId: string) {
  const rows = await getDb()
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.businessId, businessId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
