import { generateText } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { getProfile } from '@/src/lib/business';
import { lerConversaComMensagens } from '@/src/lib/channels';
import { CHANNEL_PLATFORM_LABELS } from '@/src/domain/channels';
import type { BusinessProfile } from '@/src/domain/business-profile';

/**
 * Rascunho assistido por IA para o atendimento omnichannel.
 *
 * Gera UMA sugestão de resposta para o dono enviar — ele revisa, edita e dispara
 * (o envio em si está em src/lib/channels.ts). Coerente com o guardrail do agente
 * de prospecção: a IA só rascunha; o contato é sempre iniciado/conduzido pelo
 * dono, nada de outreach automatizado.
 *
 * Contexto do rascunho: o Perfil do Negócio (mesmo que alimenta as personas) +
 * o histórico recente da conversa, montados num prompt para o tier `worker`.
 */

/** Quantas mensagens do fim da thread entram no contexto do rascunho. */
const MAX_MENSAGENS = 20;

export async function rascunharResposta(
  businessId: string,
  conversationId: string,
  instrucao?: string,
): Promise<string> {
  const data = await lerConversaComMensagens(businessId, conversationId);
  if (!data) throw new Error('Conversa não encontrada.');

  const perfil = (await getProfile(businessId))?.profile as BusinessProfile | undefined;
  const nomeContato = data.conversa.nomeContato ?? 'o cliente';
  const canal = CHANNEL_PLATFORM_LABELS[data.conversa.platform];

  const historico = data.mensagens
    .slice(-MAX_MENSAGENS)
    .map(
      (m) =>
        `${m.direction === 'entrada' ? nomeContato : 'Você'}: ${m.texto ?? `[${m.tipo}]`}`,
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
    : 'Perfil do negócio ainda não preenchido — seja genérico e cordial.';

  const system = [
    'Você é o assistente de atendimento e vendas do negócio, redigindo no lugar do DONO.',
    `Escreva UMA resposta curta para enviar pelo ${canal}, em português brasileiro,`,
    'com tom cordial, próximo e profissional — como uma conversa real de mensageiro.',
    'Não repita saudações se a conversa já começou. Sem emojis em excesso.',
    'Não invente preços, prazos ou condições que não estejam no contexto.',
    'Responda SOMENTE com o texto da mensagem: sem aspas, sem rótulos, sem assinatura.',
  ].join(' ');

  const prompt = [
    'Contexto do negócio:',
    ctxNegocio,
    '',
    `Conversa até aqui (com ${nomeContato}):`,
    historico || '(ainda sem mensagens)',
    '',
    instrucao ? `Orientação do dono para esta resposta: ${instrucao}` : '',
    'Escreva a próxima mensagem do dono:',
  ]
    .filter(Boolean)
    .join('\n');

  const r = await generateText({ model: modelFor('worker'), system, prompt });
  return r.text.trim();
}
