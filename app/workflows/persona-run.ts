import { getWritable, getWorkflowMetadata } from 'workflow';
import type { UIMessageChunk, ModelMessage } from 'ai';
import { getConteudoAgent } from '@/src/agents/personas/conteudo-aquisicao/agent';
import { getPesquisaAgent } from '@/src/agents/personas/pesquisa-mercado/agent';
import { getVendasAgent } from '@/src/agents/personas/vendas-prospeccao/agent';
import {
  atualizarRunStatus,
  carregarInstrucoes,
  emitirStatus,
  extrairEntregavel,
  lerCheckpoint,
  salvarEntregavel,
  salvarRascunho,
} from '@/app/steps/persistir';
import type { PersonaRunInput } from '@/src/domain/persona';

/**
 * Extrai o texto final (rascunho) das mensagens do resultado do agente.
 * Junta o texto de todas as mensagens do assistente, na ordem.
 */
function extrairTexto(messages: ModelMessage[]): string {
  const partes: string[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    if (typeof m.content === 'string') {
      partes.push(m.content);
      continue;
    }
    for (const c of m.content) {
      if (c.type === 'text') partes.push(c.text);
    }
  }
  return partes.join('\n\n').trim();
}

/**
 * Workflow durável de uma persona.
 *
 * Roda o agente (DurableAgent) com o perfil + tarefa, narra o progresso pelo
 * stream default do run, estrutura o entregável e persiste tudo. Eventos de
 * status para o painel "Time" vão pelo stream namespace "status".
 *
 * RETOMADA: o SDK não reexecuta o journal de um run que falhou (start() sempre
 * cria um run novo). Para "continuar de onde parou", o workflow é IDEMPOTENTE —
 * lê o checkpoint do entregável e pula o que já foi feito: se já há conteúdo,
 * finaliza; se já há rascunho, não regenera com o LLM, só estrutura/salva.
 */
export async function personaRunWorkflow(input: PersonaRunInput): Promise<{
  deliverableId: string;
}> {
  'use workflow';

  // runId deste run de Workflow — é o mesmo valor gravado em runs.run_id
  // quando o CEO delega (start() → run.runId).
  const { workflowRunId } = getWorkflowMetadata();

  try {
    await emitirStatus({
      kind: 'status',
      personaId: input.personaId,
      status: 'working',
      mensagem: 'Começando...',
    });

    // Checkpoint: o que já foi produzido para este entregável?
    const checkpoint = await lerCheckpoint(input.deliverableId);

    // Já concluído numa execução anterior → só sinaliza e encerra.
    if (checkpoint?.content) {
      await atualizarRunStatus(workflowRunId, 'done');
      await emitirStatus({
        kind: 'entregavel',
        personaId: input.personaId,
        deliverableId: input.deliverableId,
      });
      await emitirStatus({
        kind: 'status',
        personaId: input.personaId,
        status: 'done',
        mensagem: 'Concluído',
      });
      return { deliverableId: input.deliverableId };
    }

    // Rascunho: reaproveita o checkpoint ou gera com o agente.
    let rascunho = checkpoint?.rascunho ?? '';
    if (rascunho) {
      await emitirStatus({
        kind: 'status',
        personaId: input.personaId,
        status: 'working',
        mensagem: 'Retomando: rascunho recuperado, estruturando...',
      });
    } else {
      // O playbook é lido do filesystem dentro de um step (Node), depois passado
      // ao agente construído aqui no workflow.
      const instructions = await carregarInstrucoes(input.personaId);
      const toolsCtx = {
        businessId: input.businessId,
        personaId: input.personaId,
        runId: workflowRunId,
      };
      const agent =
        input.personaId === 'conteudo-aquisicao'
          ? getConteudoAgent(instructions, toolsCtx)
          : input.personaId === 'vendas-prospeccao'
            ? getVendasAgent(instructions, toolsCtx)
            : getPesquisaAgent(instructions, toolsCtx);

      // Stream default do run: narração do worker (UIMessageChunk).
      const writable = getWritable<UIMessageChunk>();

      const conteudoMensagem = [
        '## Perfil do negócio (JSON)',
        JSON.stringify(input.profile, null, 2),
        '',
        '## Sua tarefa',
        input.tarefa,
        '',
        'Trabalhe a tarefa com base no perfil. Antes de começar, consulte a memória da empresa (consultarMemoria) e os entregáveis anteriores (listarEntregaveis) para aproveitar o que o time já sabe e não repetir trabalho. Use buscaWeb/lerPagina quando precisar de informações reais (somente fontes públicas; cite as URLs) e consultarCnpj para qualificar empresas. Ao final: (1) salve na memória (salvarArtefato) um resumo dos achados úteis para o time que não estarão óbvios no entregável; (2) entregue um rascunho completo e bem organizado em português brasileiro.',
      ].join('\n');

      const result = await agent.stream({
        messages: [{ role: 'user', content: conteudoMensagem }],
        writable,
      });

      rascunho = extrairTexto(result.messages);
      // Checkpoint: grava o rascunho antes de estruturar, para que uma falha
      // na etapa seguinte não custe outra geração do LLM ao retomar.
      await salvarRascunho(input.deliverableId, rascunho);
    }

    const content = await extrairEntregavel({
      personaId: input.personaId,
      profile: input.profile,
      tarefa: input.tarefa,
      rascunho,
    });

    await salvarEntregavel(input.deliverableId, content);
    await atualizarRunStatus(workflowRunId, 'done');

    await emitirStatus({
      kind: 'entregavel',
      personaId: input.personaId,
      deliverableId: input.deliverableId,
    });
    await emitirStatus({
      kind: 'status',
      personaId: input.personaId,
      status: 'done',
      mensagem: 'Concluído',
    });

    return { deliverableId: input.deliverableId };
  } catch (err) {
    await atualizarRunStatus(workflowRunId, 'error');
    await emitirStatus({
      kind: 'status',
      personaId: input.personaId,
      status: 'error',
      mensagem: 'Falhou ao executar a tarefa',
    });

    // FatalError (erro permanente) sobe como permanente; os demais permanecem
    // retryáveis pelo mecanismo de steps do Workflow. Em ambos os casos, rethrow.
    throw err;
  }
}
