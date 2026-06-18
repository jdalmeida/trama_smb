import { criarPost } from '@/src/lib/social-posts';

/**
 * Acesso às publicações sociais como função "use step", para uso pela tool
 * `criarRascunhoPost` da persona de Conteúdo & Aquisição (agente durável).
 */

/**
 * Cria um rascunho de post na fila de Publicações do dono. Entra como
 * `rascunho` (origem `ia_sugestao`) e só vai à rede quando o dono aprova — a
 * persona apenas escreve a legenda; o dono anexa a imagem, escolhe a rede e
 * publica.
 */
export async function criarRascunhoPostStep(input: {
  businessId: string;
  texto: string;
  canalSugerido?: string;
  runId?: string;
}): Promise<{ id: string }> {
  'use step';
  console.log('[criarRascunhoPostStep] início', {
    businessId: input.businessId,
    canalSugerido: input.canalSugerido,
  });
  const post = await criarPost(input.businessId, {
    texto: input.texto,
    alvos: [],
    canalSugerido: input.canalSugerido,
    origem: 'ia_sugestao',
    meta: input.runId ? { runId: input.runId } : {},
  });
  console.log('[criarRascunhoPostStep] fim', { id: post.id });
  return { id: post.id };
}
