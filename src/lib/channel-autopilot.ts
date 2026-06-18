import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/src/db';
import {
  channelConversations,
  channelMessages,
  channelSignals,
} from '@/src/db/schema';
import {
  type AtendimentoSinal,
  type AutopilotEstadoDTO,
  type ChannelSignalDTO,
  type LeadSignalStatus,
} from '@/src/domain/channel-autopilot';

/**
 * Repositório do piloto automático: liga/desliga por conversa e persiste os
 * SINAIS que o agente de atendimento extrai para o CEO reagir. Tudo escopado por
 * businessId (mesmo tenancy do resto do omnichannel).
 */

type SignalRow = typeof channelSignals.$inferSelect;

function toSignal(r: SignalRow): ChannelSignalDTO {
  return {
    id: r.id,
    conversationId: r.conversationId,
    tipo: r.tipo,
    resumo: r.resumo,
    prioridade: r.prioridade,
    status: r.status,
    acaoCeo: r.acaoCeo,
    criadoEm: r.createdAt.toISOString(),
    processadoEm: r.processadoEm ? r.processadoEm.toISOString() : null,
  };
}

/* ------------------------------------------------------------------ *
 * Config do piloto (por conversa)
 * ------------------------------------------------------------------ */

/** Lê o estado do piloto de uma conversa (ou null se a conversa não existe). */
export async function lerAutopilot(
  businessId: string,
  conversationId: string,
): Promise<AutopilotEstadoDTO | null> {
  const rows = await getDb()
    .select({
      autopilot: channelConversations.autopilot,
      instrucao: channelConversations.autopilotInstrucao,
    })
    .from(channelConversations)
    .where(
      and(
        eq(channelConversations.id, conversationId),
        eq(channelConversations.businessId, businessId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ativo: row.autopilot, instrucao: row.instrucao };
}

/**
 * Liga/desliga o piloto de uma conversa. Ao LIGAR, exige que o dono já tenha
 * enviado ao menos uma mensagem (o contato é sempre iniciado por ele — guardrail
 * LGPD/CDC). Lançar erro deixa a rota responder 400 com a mensagem.
 */
export async function definirAutopilot(
  businessId: string,
  conversationId: string,
  ativo: boolean,
  instrucao?: string,
): Promise<AutopilotEstadoDTO> {
  const db = getDb();

  const rows = await db
    .select({ id: channelConversations.id })
    .from(channelConversations)
    .where(
      and(
        eq(channelConversations.id, conversationId),
        eq(channelConversations.businessId, businessId),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error('Conversa não encontrada.');

  if (ativo) {
    const [saida] = await db
      .select({ id: channelMessages.id })
      .from(channelMessages)
      .where(
        and(
          eq(channelMessages.conversationId, conversationId),
          eq(channelMessages.direction, 'saida'),
        ),
      )
      .limit(1);
    if (!saida) {
      throw new Error(
        'Inicie a conversa (envie ao menos uma mensagem) antes de ligar o piloto automático.',
      );
    }
  }

  const [row] = await db
    .update(channelConversations)
    .set({
      autopilot: ativo,
      // Só sobrescreve a diretriz quando o chamador a informa.
      autopilotInstrucao: instrucao === undefined ? undefined : instrucao || null,
      updatedAt: new Date(),
    })
    .where(eq(channelConversations.id, conversationId))
    .returning({
      autopilot: channelConversations.autopilot,
      instrucao: channelConversations.autopilotInstrucao,
    });

  return { ativo: row.autopilot, instrucao: row.instrucao };
}

/* ------------------------------------------------------------------ *
 * Sinais
 * ------------------------------------------------------------------ */

/** Persiste os sinais extraídos numa rodada de atendimento (status 'novo'). */
export async function registrarSinais(
  businessId: string,
  conversationId: string,
  sinais: AtendimentoSinal[],
  messageId?: string | null,
): Promise<ChannelSignalDTO[]> {
  if (sinais.length === 0) return [];
  const rows = await getDb()
    .insert(channelSignals)
    .values(
      sinais.map((s) => ({
        businessId,
        conversationId,
        messageId: messageId ?? null,
        tipo: s.tipo,
        resumo: s.resumo,
        prioridade: s.prioridade,
        status: 'novo' as LeadSignalStatus,
      })),
    )
    .returning();
  return rows.map(toSignal);
}

/** Lista os sinais de uma conversa (mais recentes primeiro). */
export async function listarSinais(
  businessId: string,
  conversationId: string,
): Promise<ChannelSignalDTO[]> {
  const rows = await getDb()
    .select()
    .from(channelSignals)
    .where(
      and(
        eq(channelSignals.businessId, businessId),
        eq(channelSignals.conversationId, conversationId),
      ),
    )
    .orderBy(desc(channelSignals.createdAt));
  return rows.map(toSignal);
}

/**
 * Atualiza o status de um conjunto de sinais (e, opcionalmente, o resumo da ação
 * do CEO). Usado pelo workflow ao começar a reagir ('processando') e ao concluir
 * ('processado'/'erro'). Escopado por businessId.
 */
export async function marcarSinaisStatus(
  businessId: string,
  ids: string[],
  status: LeadSignalStatus,
  acaoCeo?: string,
): Promise<void> {
  if (ids.length === 0) return;
  const concluido = status === 'processado' || status === 'erro' || status === 'ignorado';
  await getDb()
    .update(channelSignals)
    .set({
      status,
      acaoCeo: acaoCeo === undefined ? undefined : acaoCeo,
      processadoEm: concluido ? new Date() : undefined,
    })
    .where(
      and(
        eq(channelSignals.businessId, businessId),
        inArray(channelSignals.id, ids),
      ),
    );
}
