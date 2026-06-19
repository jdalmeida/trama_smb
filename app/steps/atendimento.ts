import type { ModelMessage } from 'ai';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { businesses } from '@/src/db/schema';
import { atenderConversa } from '@/src/agents/atendimento/agent';
import { getCeoReativoAgent } from '@/src/agents/ceo/agent';
import { enviarMensagem, lerConversaComMensagens } from '@/src/lib/channels';
import {
  lerThreadCeo,
  marcarSinaisStatus,
  registrarSinais,
  registrarThreadCeo,
  reivindicarSinaisPendentes,
} from '@/src/lib/channel-autopilot';
import { CHANNEL_PLATFORM_LABELS } from '@/src/domain/channels';
import {
  LEAD_SIGNAL_TIPO_LABELS,
  type AtendimentoOutput,
  type ChannelSignalDTO,
} from '@/src/domain/channel-autopilot';

/**
 * Passos ("use step") do piloto automático do inbox. Cada um é uma unidade Node
 * retryável: gerar a resposta+sinais, enviar ao lead, persistir os sinais,
 * acionar o CEO e fechar o ciclo marcando os sinais. Orquestrados pelo workflow
 * em app/workflows/atendimento-run.ts.
 */

/** Roda o agente de atendimento: próxima resposta para o lead + sinais. */
export async function gerarAtendimento(
  businessId: string,
  conversationId: string,
): Promise<AtendimentoOutput> {
  'use step';
  console.log('[atendimento.gerar] início', { conversationId });
  const out = await atenderConversa(businessId, conversationId);
  console.log('[atendimento.gerar] fim', {
    conversationId,
    deveResponder: out.deveResponder,
    sinais: out.sinais.length,
  });
  return out;
}

/** Envia a resposta do piloto ao lead (marcada como automática). */
export async function enviarRespostaAutopilot(
  businessId: string,
  conversationId: string,
  texto: string,
): Promise<void> {
  'use step';
  console.log('[atendimento.enviar] início', { conversationId, tamanho: texto.length });
  await enviarMensagem(businessId, conversationId, texto, { automatica: true });
  console.log('[atendimento.enviar] fim', { conversationId });
}

/** Persiste os sinais extraídos (status 'novo') e devolve as linhas criadas. */
export async function persistirSinais(
  businessId: string,
  conversationId: string,
  sinais: AtendimentoOutput['sinais'],
): Promise<ChannelSignalDTO[]> {
  'use step';
  const rows = await registrarSinais(businessId, conversationId, sinais);
  console.log('[atendimento.sinais] persistidos', {
    conversationId,
    total: rows.length,
  });
  return rows;
}

/**
 * Aciona o CEO em modo autônomo para reagir aos sinais pendentes de uma conversa.
 *
 * Consome a FILA de sinais (dequeue atômico de tudo que está 'novo'): colapsa
 * uma rajada de mensagens do lead numa única reação e garante que o mesmo sinal
 * nunca seja reagido 2x (ver `reivindicarSinaisPendentes`). Carrega a CONVERSA
 * DO CEO sobre este lead e a passa como histórico, então o CEO decide vendo o
 * que já fez e como os sinais evoluíram — em vez de começar do zero a cada vez.
 *
 * Cada rodada vira dois turnos persistidos: 'user' (os sinais) e 'assistant' (o
 * resumo do que o CEO fez). `start()` chamado pelas tools de delegação é
 * permitido aqui porque isto é um step.
 *
 * Devolve quantos sinais foram tratados, ou null quando a fila estava vazia
 * (nada a fazer / outro run já drenou). A falha do CEO é tratada aqui mesmo
 * (sinais marcados 'erro') e NÃO é relançada: o step sempre completa, então um
 * retry não deixa sinais presos em 'processando'.
 */
export async function reagirComoCeo(
  businessId: string,
  conversationId: string,
): Promise<{ total: number } | null> {
  'use step';

  // Dequeue atômico: reivindica o lote inteiro de sinais pendentes.
  const sinais = await reivindicarSinaisPendentes(businessId, conversationId);
  if (sinais.length === 0) return null;
  const ids = sinais.map((s) => s.id);
  console.log('[atendimento.ceo] início', { conversationId, sinais: sinais.length });

  const [biz] = await getDb()
    .select({ ownerUserId: businesses.ownerUserId })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const data = await lerConversaComMensagens(businessId, conversationId);
  const nome = data?.conversa.nomeContato ?? data?.conversa.externalUserId ?? 'lead';
  const canal = data ? CHANNEL_PLATFORM_LABELS[data.conversa.platform] : 'canal';
  const trecho = (data?.mensagens ?? [])
    .slice(-12)
    .map((m) => `${m.direction === 'entrada' ? nome : 'Negócio'}: ${m.texto ?? `[${m.tipo}]`}`)
    .join('\n');

  // Os sinais desta rodada, formatados — é o que fica persistido no turno 'user'.
  const linhasSinais = sinais
    .map(
      (s) =>
        `- [${LEAD_SIGNAL_TIPO_LABELS[s.tipo]} | prioridade ${s.prioridade}] ${s.resumo}`,
    )
    .join('\n');

  // Histórico das reações anteriores a ESTE lead (memória do CEO).
  const thread = await lerThreadCeo(businessId, conversationId);
  const historico: ModelMessage[] = thread.map((t) => ({
    role: t.role,
    content: t.conteudo,
  }));

  // Mensagem desta rodada: sinais novos + trecho atual da conversa do lead.
  const mensagemAtual = [
    `O piloto automático está atendendo um lead (${nome}) pelo ${canal}.`,
    'O atendimento detectou estes sinais nesta rodada:',
    linhasSinais,
    '',
    'Trecho recente da conversa:',
    trecho || '(sem histórico)',
    '',
    'Reaja agora conforme as instruções do modo autônomo.',
  ].join('\n');

  const agente = getCeoReativoAgent({
    ownerUserId: biz?.ownerUserId ?? '',
    businessId,
  });

  try {
    const resultado = await agente.generate({
      messages: [...historico, { role: 'user', content: mensagemAtual }],
    });
    const resumo = resultado.text.trim() || 'Sem ação necessária.';
    await registrarThreadCeo(businessId, conversationId, [
      { role: 'user', conteudo: linhasSinais, signalIds: ids },
      { role: 'assistant', conteudo: resumo },
    ]);
    await marcarSinaisStatus(businessId, ids, 'processado', resumo);
    console.log('[atendimento.ceo] fim', { conversationId, resumo: resumo.slice(0, 120) });
    return { total: sinais.length };
  } catch (err) {
    // Best-effort: o lead já foi respondido. Registra a falha na thread (para o
    // CEO ver na próxima rodada) e marca os sinais como 'erro'. Não relança.
    console.error('[atendimento.ceo] falha ao reagir', {
      conversationId,
      erro: err instanceof Error ? err.message : String(err),
    });
    await registrarThreadCeo(businessId, conversationId, [
      { role: 'user', conteudo: linhasSinais, signalIds: ids },
      { role: 'assistant', conteudo: 'Falha ao reagir aos sinais desta rodada.' },
    ]);
    await marcarSinaisStatus(businessId, ids, 'erro', 'Falha ao reagir aos sinais.');
    return { total: sinais.length };
  }
}
