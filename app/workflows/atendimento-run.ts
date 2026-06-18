import {
  atualizarSinais,
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
 *  3. persiste os sinais e aciona o CEO em modo autônomo, que reage mexendo no
 *     CRM e/ou disparando uma pesquisa em paralelo;
 *  4. fecha o ciclo registrando, em cada sinal, o que o CEO fez.
 *
 * Os passos concluídos ficam no journal do run, então um retry de um passo
 * tardio não reenvia a resposta ao lead. A falha do CEO ao reagir é NÃO-fatal: o
 * lead já foi respondido; marcamos os sinais como 'erro' e encerramos.
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

  if (out.sinais.length === 0) {
    return { conversationId, respondeu: out.deveResponder, sinais: 0 };
  }

  const sinais = await persistirSinais(businessId, conversationId, out.sinais);
  const ids = sinais.map((s) => s.id);
  await atualizarSinais(businessId, ids, 'processando');

  try {
    const resumo = await reagirComoCeo(businessId, conversationId, sinais);
    await atualizarSinais(businessId, ids, 'processado', resumo);
  } catch (err) {
    // O lead já foi respondido; a reação do CEO é melhor-esforço. Não derruba o run.
    console.error('[atendimentoAutopilot] CEO falhou ao reagir', {
      conversationId,
      erro: err instanceof Error ? err.message : String(err),
    });
    await atualizarSinais(businessId, ids, 'erro', 'Falha ao reagir aos sinais.');
  }

  return { conversationId, respondeu: out.deveResponder, sinais: sinais.length };
}
