import { eq } from 'drizzle-orm';
import { generateText, Output } from 'ai';
import { getWritable } from 'workflow';
import { getDb } from '@/src/db';
import { deliverables, runs } from '@/src/db/schema';
import { modelFor } from '@/src/ai/gateway';
import { buildInstructions } from '@/src/lib/skills';
import {
  ContentPlanSchema,
  MarketResearchSchema,
  ProspectingPlanSchema,
  type DeliverableContent,
} from '@/src/domain/deliverable';
import type {
  PersonaId,
  PersonaStatus,
  PersonaStatusEvent,
} from '@/src/domain/persona';
import type { BusinessProfile } from '@/src/domain/business-profile';

/**
 * Passos ("use step") usados pelos workflows de persona.
 *
 * Cada função aqui é uma unidade Node retryável e com acesso a I/O:
 * - persistência no banco (deliverables / runs);
 * - emissão de eventos de status pelo stream do run (namespace "status");
 * - extração estruturada do entregável final (generateText + Output.object).
 *
 * As tools de internet (buscaWeb, lerPagina, consultarCnpj) estão em
 * app/steps/web.ts; as de memória da empresa em app/steps/memoria.ts.
 */

/** Persiste o conteúdo final do entregável e marca como concluído. */
export async function salvarEntregavel(
  deliverableId: string,
  content: DeliverableContent,
): Promise<void> {
  'use step';
  console.log('[salvarEntregavel] início', { deliverableId, tipo: content.tipo });
  await getDb()
    .update(deliverables)
    .set({ content, status: 'done', updatedAt: new Date() })
    .where(eq(deliverables.id, deliverableId));
  console.log('[salvarEntregavel] fim', { deliverableId });
}

/** Atualiza o status de um run (localizado por runId). */
export async function atualizarRunStatus(
  runId: string,
  status: PersonaStatus,
): Promise<void> {
  'use step';
  console.log('[atualizarRunStatus] início', { runId, status });
  await getDb()
    .update(runs)
    .set({ status, updatedAt: new Date() })
    .where(eq(runs.runId, runId));
  console.log('[atualizarRunStatus] fim', { runId, status });
}

/** Emite um evento de status para a UI pelo stream do run (namespace "status"). */
export async function emitirStatus(event: PersonaStatusEvent): Promise<void> {
  'use step';
  console.log('[emitirStatus]', event);
  const w = getWritable<PersonaStatusEvent>({ namespace: 'status' }).getWriter();
  try {
    await w.write(event);
  } finally {
    w.releaseLock();
  }
}

/**
 * Carrega o playbook (instructions) de uma persona. Lê o filesystem (gray-matter),
 * por isso PRECISA ser um step — funções "use workflow" não têm acesso a Node.
 */
export async function carregarInstrucoes(personaId: PersonaId): Promise<string> {
  'use step';
  console.log('[carregarInstrucoes] início', { personaId });
  const instrucoes = buildInstructions(personaId);
  console.log('[carregarInstrucoes] fim', { personaId, tamanho: instrucoes.length });
  return instrucoes;
}

/**
 * Estrutura o rascunho final do agente no formato do entregável da persona.
 * Usa output estruturado (one-shot) com o schema correto conforme a persona.
 */
export async function extrairEntregavel(args: {
  personaId: PersonaId;
  profile: BusinessProfile;
  tarefa: string;
  rascunho: string;
}): Promise<DeliverableContent> {
  'use step';
  console.log('[extrairEntregavel] início', { personaId: args.personaId });

  const ehConteudo = args.personaId === 'conteudo-aquisicao';
  const ehVendas = args.personaId === 'vendas-prospeccao';

  const system = ehVendas
    ? 'Você organiza o rascunho de um especialista em prospecção num plano estruturado, em português brasileiro. Liste somente oportunidades/canais PÚBLICOS presentes no rascunho — nunca contatos pessoais (e-mails/telefones de pessoas físicas) nem outreach automatizado; o contato é sempre feito pelo dono. Seja fiel ao rascunho e não invente fatos.'
    : ehConteudo
    ? 'Você organiza o rascunho de um especialista em conteúdo e aquisição num plano estruturado, em português brasileiro. Seja concreto e fiel ao rascunho; não invente fatos.'
    : 'Você organiza o rascunho de um especialista em pesquisa de mercado numa pesquisa estruturada, em português brasileiro. Use somente informações de fontes públicas presentes no rascunho; cite URLs quando houver e não invente dados.';

  const prompt = [
    '## Perfil do negócio (JSON)',
    JSON.stringify(args.profile, null, 2),
    '',
    '## Tarefa delegada pelo CEO',
    args.tarefa,
    '',
    '## Rascunho produzido pelo especialista',
    args.rascunho,
    '',
    'Organize o conteúdo acima no formato estruturado solicitado, em português brasileiro.',
  ].join('\n');

  if (ehVendas) {
    const r = await generateText({
      model: modelFor('worker'),
      system,
      prompt,
      output: Output.object({ schema: ProspectingPlanSchema }),
    });
    console.log('[extrairEntregavel] fim', { personaId: args.personaId });
    return { tipo: 'plano-prospeccao', ...r.output };
  }

  if (ehConteudo) {
    const r = await generateText({
      model: modelFor('worker'),
      system,
      prompt,
      output: Output.object({ schema: ContentPlanSchema }),
    });
    console.log('[extrairEntregavel] fim', { personaId: args.personaId });
    return { tipo: 'plano-conteudo', ...r.output };
  }

  const r = await generateText({
    model: modelFor('worker'),
    system,
    prompt,
    output: Output.object({ schema: MarketResearchSchema }),
  });
  console.log('[extrairEntregavel] fim', { personaId: args.personaId });
  return { tipo: 'pesquisa-mercado', ...r.output };
}
