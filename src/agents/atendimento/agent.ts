import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { buildInstructions } from '@/src/lib/skills';
import { getProfile } from '@/src/lib/business';
import { lerConversaComMensagens } from '@/src/lib/channels';
import { lerAutopilot } from '@/src/lib/channel-autopilot';
import { CHANNEL_PLATFORM_LABELS } from '@/src/domain/channels';
import {
  AtendimentoOutputSchema,
  type AtendimentoOutput,
} from '@/src/domain/channel-autopilot';
import type { BusinessProfile } from '@/src/domain/business-profile';

/**
 * Agente de atendimento do piloto automático.
 *
 * Numa única passada (structured output) ele faz as duas coisas: redige a
 * próxima resposta para o lead e lista os SINAIS relevantes para o CEO. Usa o
 * mesmo contexto do rascunho assistido (Perfil do Negócio + histórico recente),
 * mais a diretriz do dono para esta conversa, e o playbook `atendimento`.
 *
 * Não tem tools nem toca o banco para agir — quem persiste/envia/aciona o CEO é
 * o workflow durável (app/workflows/atendimento-run.ts). Aqui é só raciocínio.
 */

/** Quantas mensagens do fim da thread entram no contexto. */
const MAX_MENSAGENS = 24;

export async function atenderConversa(
  businessId: string,
  conversationId: string,
): Promise<AtendimentoOutput> {
  const data = await lerConversaComMensagens(businessId, conversationId);
  if (!data) throw new Error('Conversa não encontrada.');

  // Guarda: só responde se a última mensagem for do lead (entrada). Evita que
  // ciclos concorrentes (várias mensagens seguidas) gerem respostas duplicadas.
  const ultima = data.mensagens.at(-1);
  if (!ultima || ultima.direction !== 'entrada') {
    return { deveResponder: false, resposta: '', sinais: [] };
  }

  const perfil = (await getProfile(businessId))?.profile as BusinessProfile | undefined;
  const estado = await lerAutopilot(businessId, conversationId);
  const nomeContato = data.conversa.nomeContato ?? 'o cliente';
  const canal = CHANNEL_PLATFORM_LABELS[data.conversa.platform];

  const historico = data.mensagens
    .slice(-MAX_MENSAGENS)
    .map(
      (m) =>
        `${m.direction === 'entrada' ? nomeContato : 'Negócio'}: ${m.texto ?? `[${m.tipo}]`}`,
    )
    .join('\n');

  const ctxNegocio = perfil
    ? [
        `Negócio: ${perfil.nomeNegocio} (${perfil.setor}).`,
        `Produto/serviço: ${perfil.produtoServico}.`,
        perfil.publicoAlvo ? `Público-alvo: ${perfil.publicoAlvo}.` : '',
        perfil.diferenciais?.length
          ? `Diferenciais: ${perfil.diferenciais.join('; ')}.`
          : '',
        perfil.ticketMedio ? `Ticket médio: ${perfil.ticketMedio}.` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Perfil do negócio ainda não preenchido — seja genérico, cordial e não invente dados.';

  const prompt = [
    '## Contexto do negócio',
    ctxNegocio,
    '',
    estado?.instrucao ? `## Diretriz do dono para esta conversa\n${estado.instrucao}\n` : '',
    `## Conversa no ${canal} (com ${nomeContato})`,
    historico || '(sem mensagens)',
    '',
    'Responda a última mensagem do lead e extraia os sinais relevantes, no formato estruturado.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const r = await generateText({
      model: modelFor('worker'),
      system: buildInstructions('atendimento'),
      prompt,
      output: Output.object({ schema: AtendimentoOutputSchema }),
    });
    const out = r.output;
    // Saneamento: se mandou responder mas veio vazio, trata como silêncio.
    const resposta = out.resposta?.trim() ?? '';
    return {
      deveResponder: out.deveResponder && resposta.length > 0,
      resposta,
      sinais: out.sinais ?? [],
    };
  } catch (err) {
    // Se o modelo não produziu objeto válido, não responde nada nesta rodada
    // (melhor o silêncio do que uma mensagem ruim para o lead).
    if (NoObjectGeneratedError.isInstance(err)) {
      console.warn('[atenderConversa] saída estruturada falhou; em silêncio', {
        conversationId,
        finishReason: err.finishReason,
      });
      return { deveResponder: false, resposta: '', sinais: [] };
    }
    throw err;
  }
}
