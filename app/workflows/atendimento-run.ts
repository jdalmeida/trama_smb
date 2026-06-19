import {
  enviarRespostaAutopilot,
  gerarAtendimento,
  persistirSinais,
  reagirComoCeo,
} from '@/app/steps/atendimento';

/** Entrada do workflow do piloto: a conversa que recebeu uma mensagem do lead. */
export interface AtendimentoRunInput {
  businessId: string;
  conversationId: string;
}

/**
 * Workflow durável do piloto automático.
 *
 * Disparado a cada entrada ao vivo do lead numa conversa com o piloto ligado
 * (ver src/lib/autopilot-trigger.ts, chamado pelos webhooks/simulação):
 *
 *  1. gera a próxima resposta + os sinais (agente de atendimento);
 *  2. RESPONDE o lead primeiro (caminho rápido e idempotente — fica no journal);
 *  3. enfileira os sinais (status 'novo') e aciona o CEO, que CONSOME a fila da
 *     conversa: reage uma única vez ao lote pendente, vendo o que já fez antes
 *     para este lead (conversa do CEO persistida), e fecha cada sinal.
 *
 * Os passos concluídos ficam no journal do run, então um retry de um passo
 * tardio não reenvia a resposta ao lead. `reagirComoCeo` é chamado sempre (mesmo
 * sem sinais nesta rodada) para também drenar sinais pendentes de runs anteriores
 * que tenham falhado; ele já trata a própria falha (marca 'erro') sem derrubar o
 * run — o lead já foi respondido.
 */
export async function atendimentoAutopilotWorkflow(
  input: AtendimentoRunInput,
): Promise<{ conversationId: string; respondeu: boolean; sinais: number }> {
  'use workflow';

  const { businessId, conversationId } = input;

  const out = await gerarAtendimento(businessId, conversationId);

  if (out.deveResponder && out.resposta) {
    await enviarRespostaAutopilot(businessId, conversationId, out.resposta);
  }

  if (out.sinais.length > 0) {
    await persistirSinais(businessId, conversationId, out.sinais);
  }

  const reacao = await reagirComoCeo(businessId, conversationId);

  return {
    conversationId,
    respondeu: out.deveResponder,
    sinais: reacao?.total ?? 0,
  };
}
