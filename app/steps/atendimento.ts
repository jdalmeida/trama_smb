import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { businesses } from '@/src/db/schema';
import { atenderConversa } from '@/src/agents/atendimento/agent';
import { getCeoReativoAgent } from '@/src/agents/ceo/agent';
import { enviarMensagem, lerConversaComMensagens } from '@/src/lib/channels';
import {
  marcarSinaisStatus,
  registrarSinais,
} from '@/src/lib/channel-autopilot';
import { CHANNEL_PLATFORM_LABELS } from '@/src/domain/channels';
import {
  LEAD_SIGNAL_TIPO_LABELS,
  type AtendimentoOutput,
  type ChannelSignalDTO,
  type LeadSignalStatus,
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

/** Atualiza o status de um conjunto de sinais (e o resumo da ação do CEO). */
export async function atualizarSinais(
  businessId: string,
  ids: string[],
  status: LeadSignalStatus,
  acaoCeo?: string,
): Promise<void> {
  'use step';
  await marcarSinaisStatus(businessId, ids, status, acaoCeo);
}

/**
 * Aciona o CEO em modo autônomo para reagir aos sinais: ele decide e executa
 * (mexer no CRM, disparar pesquisa). `start()` chamado pelas tools de delegação
 * é permitido aqui porque isto é um step. Devolve o resumo do que o CEO fez.
 */
export async function reagirComoCeo(
  businessId: string,
  conversationId: string,
  sinais: ChannelSignalDTO[],
): Promise<string> {
  'use step';
  console.log('[atendimento.ceo] início', { conversationId, sinais: sinais.length });

  const [biz] = await getDb()
    .select({ ownerUserId: businesses.ownerUserId })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const data = await lerConversaComMensagens(businessId, conversationId);
  const nome = data?.conversa.nomeContato ?? data?.conversa.externalUserId ?? 'lead';
  const canal = data ? CHANNEL_PLATFORM_LABELS[data.conversa.platform] : 'canal';
  const historico = (data?.mensagens ?? [])
    .slice(-12)
    .map((m) => `${m.direction === 'entrada' ? nome : 'Negócio'}: ${m.texto ?? `[${m.tipo}]`}`)
    .join('\n');

  const linhasSinais = sinais
    .map(
      (s) =>
        `- [${LEAD_SIGNAL_TIPO_LABELS[s.tipo]} | prioridade ${s.prioridade}] ${s.resumo}`,
    )
    .join('\n');

  const prompt = [
    `O piloto automático está atendendo um lead (${nome}) pelo ${canal}.`,
    'O atendimento detectou estes sinais nesta rodada:',
    linhasSinais,
    '',
    'Trecho recente da conversa:',
    historico || '(sem histórico)',
    '',
    'Reaja agora conforme as instruções do modo autônomo.',
  ].join('\n');

  const agente = getCeoReativoAgent({
    ownerUserId: biz?.ownerUserId ?? '',
    businessId,
  });
  const resultado = await agente.generate({ prompt });
  const resumo = resultado.text.trim();
  console.log('[atendimento.ceo] fim', { conversationId, resumo: resumo.slice(0, 120) });
  return resumo || 'Sem ação necessária.';
}
