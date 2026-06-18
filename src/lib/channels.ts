import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/src/db';
import {
  channelConnections,
  channelConversations,
  channelMessages,
} from '@/src/db/schema';
import {
  type ChannelConnectionDTO,
  type ChannelMessageDTO,
  type ChannelPlatform,
  type ConversationDTO,
  type InboxDTO,
  type InboxItemDTO,
  type NormalizedContact,
  type NormalizedMessage,
  type SimularMensagemInput,
  CHANNEL_PLATFORM_LABELS,
} from '@/src/domain/channels';
import {
  enviarTextoMessaging,
  enviarTextoWhatsApp,
  type ContaDescoberta,
} from '@/src/lib/meta';
import { enviarTexto as enviarTextoEvolution } from '@/src/lib/evolution';

/**
 * Repositório da integração omnichannel — CRUD e ingest escopados por businessId.
 *
 * Usado pelas rotas REST (inbox/conexões) e pelo webhook (que primeiro resolve o
 * negócio a partir da conexão). Espelha o estilo de src/lib/crm.ts: mapeadores
 * para DTO e validação de ownership por businessId em toda mutação.
 */

/* ------------------------------------------------------------------ *
 * Mapeadores → DTO
 * ------------------------------------------------------------------ */

type ConnectionRow = typeof channelConnections.$inferSelect;
type ConversationRow = typeof channelConversations.$inferSelect;
type MessageRow = typeof channelMessages.$inferSelect;

function toConnection(r: ConnectionRow): ChannelConnectionDTO {
  return {
    id: r.id,
    platform: r.platform,
    status: r.status,
    nomeExibicao: r.nomeExibicao,
    externalId: r.externalId,
    simulada: r.simulada,
    provider:
      (r.meta as Record<string, unknown> | null)?.provider === 'evolution'
        ? 'evolution'
        : 'meta',
    coexistence: Boolean((r.meta as Record<string, unknown> | null)?.coexistence),
    expiraEm: r.tokenExpiraEm ? r.tokenExpiraEm.toISOString() : null,
    criadoEm: r.createdAt.toISOString(),
    atualizadoEm: r.updatedAt.toISOString(),
  };
}

function toConversation(r: ConversationRow): ConversationDTO {
  return {
    id: r.id,
    connectionId: r.connectionId,
    platform: r.platform,
    externalUserId: r.externalUserId,
    nomeContato: r.nomeContato,
    contatoId: r.contatoId,
    cardId: r.cardId,
    status: r.status,
    naoLidas: r.naoLidas,
    autopilot: r.autopilot,
    autopilotInstrucao: r.autopilotInstrucao,
    ultimaPrevia: r.ultimaPrevia,
    ultimaMensagemEm: r.ultimaMensagemEm ? r.ultimaMensagemEm.toISOString() : null,
    criadoEm: r.createdAt.toISOString(),
  };
}

function toMessage(r: MessageRow): ChannelMessageDTO {
  return {
    id: r.id,
    conversationId: r.conversationId,
    direction: r.direction,
    tipo: r.tipo,
    texto: r.texto,
    status: r.status,
    automatica: r.automatica,
    anexos: r.anexos,
    enviadaEm: r.enviadaEm.toISOString(),
    criadoEm: r.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Conexões
 * ------------------------------------------------------------------ */

export async function listarConexoes(businessId: string): Promise<ChannelConnectionDTO[]> {
  const rows = await getDb()
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.businessId, businessId))
    .orderBy(asc(channelConnections.platform), asc(channelConnections.createdAt));
  return rows.map(toConnection);
}

/**
 * Cria ou atualiza uma conexão por (businessId, platform, externalId). Reconecta
 * (status/token) sem duplicar quando o dono refaz o OAuth da mesma conta.
 */
export async function upsertConexao(
  businessId: string,
  input: {
    platform: ChannelPlatform;
    externalId: string;
    nomeExibicao: string;
    accessToken?: string | null;
    tokenExpiraEm?: Date | null;
    meta?: Record<string, unknown>;
    simulada?: boolean;
  },
): Promise<ChannelConnectionDTO> {
  const db = getDb();
  const existente = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.businessId, businessId),
        eq(channelConnections.platform, input.platform),
        eq(channelConnections.externalId, input.externalId),
      ),
    )
    .limit(1);

  if (existente[0]) {
    const [row] = await db
      .update(channelConnections)
      .set({
        nomeExibicao: input.nomeExibicao,
        status: 'conectado',
        accessToken: input.accessToken ?? existente[0].accessToken,
        tokenExpiraEm: input.tokenExpiraEm ?? existente[0].tokenExpiraEm,
        meta: input.meta ?? existente[0].meta,
        simulada: input.simulada ?? existente[0].simulada,
        updatedAt: new Date(),
      })
      .where(eq(channelConnections.id, existente[0].id))
      .returning();
    return toConnection(row);
  }

  const [row] = await db
    .insert(channelConnections)
    .values({
      businessId,
      platform: input.platform,
      externalId: input.externalId,
      nomeExibicao: input.nomeExibicao,
      accessToken: input.accessToken ?? null,
      tokenExpiraEm: input.tokenExpiraEm ?? null,
      meta: input.meta ?? {},
      simulada: input.simulada ?? false,
    })
    .returning();
  return toConnection(row);
}

/** Persiste as contas descobertas no OAuth como conexões. Retorna quantas. */
export async function salvarContasDescobertas(
  businessId: string,
  contas: ContaDescoberta[],
  tokenExpiraEm: Date | null,
): Promise<number> {
  for (const c of contas) {
    await upsertConexao(businessId, {
      platform: c.platform,
      externalId: c.externalId,
      nomeExibicao: c.nomeExibicao,
      accessToken: c.accessToken,
      tokenExpiraEm,
      meta: c.meta,
      simulada: false,
    });
  }
  return contas.length;
}

export async function desconectar(businessId: string, connectionId: string): Promise<void> {
  await getDb()
    .delete(channelConnections)
    .where(
      and(
        eq(channelConnections.id, connectionId),
        eq(channelConnections.businessId, businessId),
      ),
    );
}

/* ------------------------------------------------------------------ *
 * Inbox / conversas
 * ------------------------------------------------------------------ */

export async function getInbox(businessId: string): Promise<InboxDTO> {
  const db = getDb();
  const [convRows, conexoes] = await Promise.all([
    db
      .select()
      .from(channelConversations)
      .where(eq(channelConversations.businessId, businessId))
      .orderBy(desc(channelConversations.ultimaMensagemEm), desc(channelConversations.createdAt)),
    listarConexoes(businessId),
  ]);

  const nomePorConexao = new Map(conexoes.map((c) => [c.id, c.nomeExibicao]));
  const conversas: InboxItemDTO[] = convRows.map((r) => ({
    ...toConversation(r),
    conexaoNome:
      nomePorConexao.get(r.connectionId) ?? CHANNEL_PLATFORM_LABELS[r.platform],
  }));

  return { conversas, conexoes };
}

export async function lerConversaComMensagens(
  businessId: string,
  conversationId: string,
): Promise<{ conversa: ConversationDTO; mensagens: ChannelMessageDTO[] } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(channelConversations)
    .where(
      and(
        eq(channelConversations.id, conversationId),
        eq(channelConversations.businessId, businessId),
      ),
    )
    .limit(1);
  const conv = rows[0];
  if (!conv) return null;

  const mensagens = await db
    .select()
    .from(channelMessages)
    .where(eq(channelMessages.conversationId, conversationId))
    .orderBy(asc(channelMessages.enviadaEm), asc(channelMessages.createdAt));

  return { conversa: toConversation(conv), mensagens: mensagens.map(toMessage) };
}

/** Zera o contador de não lidas de uma conversa (ao abri-la no inbox). */
export async function marcarLida(businessId: string, conversationId: string): Promise<void> {
  await getDb()
    .update(channelConversations)
    .set({ naoLidas: 0, updatedAt: new Date() })
    .where(
      and(
        eq(channelConversations.id, conversationId),
        eq(channelConversations.businessId, businessId),
      ),
    );
}

/* ------------------------------------------------------------------ *
 * Envio (dono → interlocutor)
 * ------------------------------------------------------------------ */

/**
 * Envia uma mensagem de texto do dono para o interlocutor de uma conversa,
 * roteando pelo provedor da conexão:
 *  - simulada  → apenas registra (sem chamada externa);
 *  - evolution → Evolution API (WhatsApp não-oficial);
 *  - meta + whatsapp  → Cloud API;
 *  - meta + messenger/instagram → Send API.
 *
 * A saída é persistida pelo MESMO caminho do webhook (ingestMensagem), usando o
 * id devolvido pela plataforma como `externalMessageId` — assim o echo que volta
 * (coexistência) é deduplicado em vez de duplicar a bolha.
 *
 * Guardrail (LGPD/CDC): o contato é sempre iniciado pelo dono — este envio é uma
 * ação manual; a IA apenas rascunha (ver src/lib/channel-ai.ts).
 */
export async function enviarMensagem(
  businessId: string,
  conversationId: string,
  texto: string,
  opts?: { automatica?: boolean },
): Promise<{ conversationId: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ conv: channelConversations, conn: channelConnections })
    .from(channelConversations)
    .innerJoin(
      channelConnections,
      eq(channelConversations.connectionId, channelConnections.id),
    )
    .where(
      and(
        eq(channelConversations.id, conversationId),
        eq(channelConversations.businessId, businessId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error('Conversa não encontrada.');
  const { conv, conn } = row;

  const provider =
    (conn.meta as Record<string, unknown> | null)?.provider === 'evolution'
      ? 'evolution'
      : 'meta';

  let externalMessageId: string | null;
  if (conn.simulada) {
    externalMessageId = `sim-out-${randomId()}`;
  } else if (provider === 'evolution') {
    externalMessageId = await enviarTextoEvolution(
      conn.externalId,
      conv.externalUserId,
      texto,
    );
  } else if (conn.platform === 'whatsapp') {
    if (!conn.accessToken) throw new Error('Conexão sem token de acesso.');
    externalMessageId = await enviarTextoWhatsApp(
      conn.externalId,
      conn.accessToken,
      conv.externalUserId,
      texto,
    );
  } else {
    if (!conn.accessToken) throw new Error('Conexão sem token de acesso.');
    externalMessageId = await enviarTextoMessaging(
      conn.externalId,
      conn.accessToken,
      conv.externalUserId,
      texto,
    );
  }

  const r = await ingestMensagem({
    platform: conn.platform,
    connectionExternalId: conn.externalId,
    externalUserId: conv.externalUserId,
    nomeContato: null,
    externalMessageId: externalMessageId ?? `out-${randomId()}`,
    tipo: 'texto',
    texto,
    anexos: [],
    enviadaEm: Date.now(),
    direction: 'saida',
    historico: false,
    automatica: opts?.automatica ?? false,
  });
  return r ? { conversationId: r.conversationId } : null;
}

/* ------------------------------------------------------------------ *
 * Ingest (webhook → banco)
 * ------------------------------------------------------------------ */

/**
 * Persiste uma mensagem normalizada (entrada do lead OU saída do dono, inclusive
 * echoes de coexistência e mensagens do histórico). Resolve o negócio pela
 * conexão (platform + externalId), faz upsert da conversa e insere a mensagem de
 * forma idempotente (dedupe por externalMessageId — o webhook reentrega).
 *
 * Regras de coexistência:
 *  - saída (echo/history do dono) grava `direction: 'saida'` com status 'enviada'
 *    e NÃO incrementa o badge de não lidas;
 *  - histórico não pode "retroceder" a prévia: a última mensagem/horário só
 *    avançam quando a mensagem é mais recente que a já registrada.
 *
 * Retorna null silenciosamente quando a conexão não existe (mensagem para uma
 * conta que este app não gerencia) — o webhook responde 200 mesmo assim.
 */
export interface IngestResultado {
  conversationId: string;
  businessId: string;
  /**
   * Esta é uma entrada ao vivo do lead numa conversa com o piloto automático
   * ligado: o chamador (webhook/simulação) deve acionar o agente de atendimento.
   */
  autopilotPendente: boolean;
}

export async function ingestMensagem(
  msg: NormalizedMessage,
): Promise<IngestResultado | null> {
  const db = getDb();

  const conexao = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.platform, msg.platform),
        eq(channelConnections.externalId, msg.connectionExternalId),
      ),
    )
    .limit(1);
  if (!conexao[0]) {
    // Silenciar isto escondia a causa nº 1 de "não cria conversa": o id externo
    // da conta no webhook não bate com nenhuma conexão salva.
    console.warn('[ingestMensagem] conexão não encontrada — mensagem ignorada', {
      platform: msg.platform,
      connectionExternalId: msg.connectionExternalId,
      direction: msg.direction,
    });
    return null;
  }
  const { id: connectionId, businessId } = conexao[0];

  // Dedupe: se a mensagem já foi gravada (reentrega do webhook), ignora.
  if (msg.externalMessageId) {
    const jaExiste = await db
      .select({ id: channelMessages.id })
      .from(channelMessages)
      .where(
        and(
          eq(channelMessages.businessId, businessId),
          eq(channelMessages.externalMessageId, msg.externalMessageId),
        ),
      )
      .limit(1);
    if (jaExiste[0]) {
      const conv = await acharConversa(businessId, connectionId, msg.externalUserId);
      return conv
        ? { conversationId: conv, businessId, autopilotPendente: false }
        : null;
    }
  }

  const conversationId = await upsertConversa(businessId, connectionId, msg);
  const enviadaEm = new Date(msg.enviadaEm);

  await db.insert(channelMessages).values({
    businessId,
    conversationId,
    direction: msg.direction,
    status: msg.direction === 'saida' ? 'enviada' : null,
    tipo: msg.tipo,
    texto: msg.texto,
    anexos: msg.anexos,
    automatica: msg.automatica ?? false,
    externalMessageId: msg.externalMessageId || null,
    enviadaEm,
  });

  // Só mensagens de entrada ao vivo (não históricas) acendem o badge.
  const incrementaBadge = msg.direction === 'entrada' && !msg.historico;
  const previa = previaDe(msg);

  // Prévia/horário só avançam se esta mensagem for a mais recente da conversa
  // (evita que o histórico, com mensagens antigas, sobrescreva a última).
  await db
    .update(channelConversations)
    .set({
      ultimaPrevia: sql`case when ${channelConversations.ultimaMensagemEm} is null or ${channelConversations.ultimaMensagemEm} < ${enviadaEm} then ${previa} else ${channelConversations.ultimaPrevia} end`,
      ultimaMensagemEm: sql`greatest(coalesce(${channelConversations.ultimaMensagemEm}, to_timestamp(0)), ${enviadaEm})`,
      naoLidas: incrementaBadge
        ? sql`${channelConversations.naoLidas} + 1`
        : sql`${channelConversations.naoLidas}`,
      nomeContato: msg.nomeContato ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(channelConversations.id, conversationId));

  // O piloto só reage a uma entrada NOVA do lead (ao vivo) e quando está ligado.
  let autopilotPendente = false;
  if (incrementaBadge) {
    const [conv] = await db
      .select({ autopilot: channelConversations.autopilot })
      .from(channelConversations)
      .where(eq(channelConversations.id, conversationId))
      .limit(1);
    autopilotPendente = Boolean(conv?.autopilot);
  }

  return { conversationId, businessId, autopilotPendente };
}

/**
 * Aplica a sincronização de contatos do app (smb_app_state_sync): enriquece o
 * nome do interlocutor nas conversas existentes daquela conta. Não cria
 * conversas nem mexe no CRM — só melhora a exibição do inbox.
 */
export async function aplicarContatos(contatos: NormalizedContact[]): Promise<void> {
  const db = getDb();
  for (const c of contatos) {
    if (c.action !== 'add' || !c.nome) continue;
    const conexao = await db
      .select({ id: channelConnections.id, businessId: channelConnections.businessId })
      .from(channelConnections)
      .where(
        and(
          eq(channelConnections.platform, c.platform),
          eq(channelConnections.externalId, c.connectionExternalId),
        ),
      )
      .limit(1);
    if (!conexao[0]) continue;

    await db
      .update(channelConversations)
      .set({ nomeContato: c.nome, updatedAt: new Date() })
      .where(
        and(
          eq(channelConversations.businessId, conexao[0].businessId),
          eq(channelConversations.connectionId, conexao[0].id),
          eq(channelConversations.externalUserId, c.phone),
        ),
      );
  }
}

async function acharConversa(
  businessId: string,
  connectionId: string,
  externalUserId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ id: channelConversations.id })
    .from(channelConversations)
    .where(
      and(
        eq(channelConversations.businessId, businessId),
        eq(channelConversations.connectionId, connectionId),
        eq(channelConversations.externalUserId, externalUserId),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Acha a conversa do interlocutor nesta conexão ou cria uma nova. */
async function upsertConversa(
  businessId: string,
  connectionId: string,
  msg: NormalizedMessage,
): Promise<string> {
  const existente = await acharConversa(businessId, connectionId, msg.externalUserId);
  if (existente) return existente;

  const [row] = await getDb()
    .insert(channelConversations)
    .values({
      businessId,
      connectionId,
      platform: msg.platform,
      externalUserId: msg.externalUserId,
      nomeContato: msg.nomeContato,
    })
    .returning({ id: channelConversations.id });
  console.log('[ingestMensagem] conversa criada', {
    conversationId: row.id,
    platform: msg.platform,
    externalUserId: msg.externalUserId,
    direction: msg.direction,
  });
  return row.id;
}

function previaDe(msg: NormalizedMessage): string {
  if (msg.texto) return msg.texto.slice(0, 140);
  switch (msg.tipo) {
    case 'imagem':
      return '📷 Imagem';
    case 'audio':
      return '🎤 Áudio';
    case 'video':
      return '🎬 Vídeo';
    case 'arquivo':
      return '📎 Arquivo';
    case 'sticker':
      return '🌟 Figurinha';
    case 'localizacao':
      return '📍 Localização';
    default:
      return 'Nova mensagem';
  }
}

/* ------------------------------------------------------------------ *
 * Simulação (testar o inbox sem a Meta real)
 * ------------------------------------------------------------------ */

/** Garante uma conexão simulada da plataforma para o negócio (idempotente). */
export async function garantirConexaoSimulada(
  businessId: string,
  platform: ChannelPlatform,
): Promise<ChannelConnectionDTO> {
  const externalId = `sim-${platform}-${businessId}`;
  return upsertConexao(businessId, {
    platform,
    externalId,
    nomeExibicao: `${CHANNEL_PLATFORM_LABELS[platform]} (teste)`,
    simulada: true,
    // WhatsApp de teste já demonstra a coexistência (echoes + histórico).
    meta: platform === 'whatsapp' ? { coexistence: true } : {},
  });
}

/**
 * Injeta uma mensagem fictícia, exercitando o mesmo caminho do webhook real
 * (normalização → ingest). Com `direction: 'saida'` simula o dono respondendo
 * pelo app WhatsApp Business (echo de coexistência). Serve para validar a
 * fundação enquanto não há credenciais Meta.
 */
export async function simularEntrada(
  businessId: string,
  input: SimularMensagemInput,
): Promise<IngestResultado | null> {
  const conexao = await garantirConexaoSimulada(businessId, input.platform);
  const externalUserId =
    input.externalUserId ||
    `sim-user-${input.de.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
  return ingestMensagem({
    platform: input.platform,
    connectionExternalId: conexao.externalId,
    externalUserId,
    nomeContato: input.direction === 'entrada' ? input.de : null,
    externalMessageId: `sim-${randomId()}`,
    tipo: 'texto',
    texto: input.texto,
    anexos: [],
    enviadaEm: Date.now(),
    direction: input.direction,
    historico: false,
  });
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
