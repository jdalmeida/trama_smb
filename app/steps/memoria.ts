import {
  buscarArtefatos,
  criarArtefato,
  lerArtefato,
  lerEntregavel,
  listarEntregaveis,
  type ArtifactResumo,
  type CriarArtefatoInput,
} from '@/src/lib/artifacts';
import type { ArtifactCategoria } from '@/src/db/schema';

/**
 * Acesso à memória da empresa (repositório de artefatos) e aos entregáveis
 * anteriores, como funções "use step" para uso pelos agentes duráveis.
 * O CEO (não-durável) usa a lib src/lib/artifacts diretamente.
 */

/** Salva um artefato na memória da empresa. Retorna id e título. */
export async function salvarArtefatoStep(
  input: CriarArtefatoInput,
): Promise<{ id: string; titulo: string }> {
  'use step';
  console.log('[salvarArtefatoStep] início', {
    businessId: input.businessId,
    titulo: input.titulo,
  });
  const row = await criarArtefato(input);
  console.log('[salvarArtefatoStep] fim', { id: row.id });
  return { id: row.id, titulo: row.titulo };
}

/** Busca artefatos por texto/categoria; sem query, lista os mais recentes. */
export async function buscarArtefatosStep(input: {
  businessId: string;
  query?: string;
  categoria?: ArtifactCategoria;
}): Promise<ArtifactResumo[]> {
  'use step';
  console.log('[buscarArtefatosStep] início', {
    businessId: input.businessId,
    query: input.query,
  });
  const resumos = await buscarArtefatos(input.businessId, {
    query: input.query,
    categoria: input.categoria,
  });
  console.log('[buscarArtefatosStep] fim', { quantidade: resumos.length });
  return resumos;
}

/** Lê um artefato completo, escopado ao negócio. */
export async function lerArtefatoStep(input: {
  businessId: string;
  artifactId: string;
}) {
  'use step';
  console.log('[lerArtefatoStep]', input);
  const row = await lerArtefato(input.businessId, input.artifactId);
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    categoria: row.categoria,
    autor: row.autor,
    tags: row.tags,
    conteudo: row.conteudo,
    criadoEm: row.createdAt.toISOString(),
  };
}

/** Lista os entregáveis anteriores do negócio (metadados). */
export async function listarEntregaveisStep(input: { businessId: string }) {
  'use step';
  console.log('[listarEntregaveisStep]', input);
  return listarEntregaveis(input.businessId);
}

/** Lê um entregável completo (inclui o conteúdo estruturado), escopado ao negócio. */
export async function lerEntregavelStep(input: {
  businessId: string;
  deliverableId: string;
}) {
  'use step';
  console.log('[lerEntregavelStep]', input);
  const row = await lerEntregavel(input.businessId, input.deliverableId);
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    personaId: row.personaId,
    status: row.status,
    content: row.content,
    criadoEm: row.createdAt.toISOString(),
  };
}
