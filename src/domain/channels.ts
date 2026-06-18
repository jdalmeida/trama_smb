import { z } from 'zod';

/**
 * Domínio da integração omnichannel (WhatsApp, Instagram DM, Messenger).
 *
 * Os três canais são da Meta. O dono conecta suas contas (Facebook Login for
 * Business / Embedded Signup) e o app passa a RECEBER as conversas num inbox
 * unificado — esta é a Leva 1 (fundação): conectar + receber + ler. O envio e o
 * disparo assistido por IA ficam para as próximas levas.
 *
 * Guardrail (coerente com o agente de prospecção): o contato com um lead é
 * sempre iniciado pelo dono; a IA apenas sugere o rascunho. Nada de outreach
 * automatizado em massa.
 *
 * Aqui ficam os enums, os schemas zod (tools/rotas), os DTOs serializáveis que a
 * API devolve para a UI e a NORMALIZAÇÃO dos webhooks de cada plataforma para um
 * formato comum (NormalizedInboundMessage).
 */

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

/** Plataformas suportadas. Todas via APIs da Meta. */
export const CHANNEL_PLATFORMS = ['whatsapp', 'instagram', 'messenger'] as const;
export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];

export const CHANNEL_PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

/** Estado de uma conta conectada. */
export const CHANNEL_CONNECTION_STATUSES = [
  'conectado',
  'expirado',
  'revogado',
  'erro',
] as const;
export type ChannelConnectionStatus = (typeof CHANNEL_CONNECTION_STATUSES)[number];

/** Sentido da mensagem: recebida do lead (entrada) ou enviada pelo dono (saida). */
export const MESSAGE_DIRECTIONS = ['entrada', 'saida'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

/** Tipo de conteúdo de uma mensagem (normalizado entre plataformas). */
export const MESSAGE_TYPES = [
  'texto',
  'imagem',
  'audio',
  'video',
  'arquivo',
  'sticker',
  'localizacao',
  'outro',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Estado de entrega de uma mensagem de saída (preparado para a próxima leva). */
export const MESSAGE_STATUSES = [
  'enviada',
  'entregue',
  'lida',
  'falha',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Estado de uma conversa no inbox. */
export const CONVERSATION_STATUSES = ['aberta', 'arquivada'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/* ------------------------------------------------------------------ *
 * DTOs (o que a API devolve para a UI — datas como ISO string)
 * ------------------------------------------------------------------ */

export interface ChannelConnectionDTO {
  id: string;
  platform: ChannelPlatform;
  status: ChannelConnectionStatus;
  /** Nome amigável: número do WhatsApp, nome da Página ou @ do Instagram. */
  nomeExibicao: string;
  /**
   * Id externo usado pela Meta para rotear o webhook de volta: phone_number_id
   * (WhatsApp), page_id (Messenger) ou ig_id (Instagram).
   */
  externalId: string;
  /** Conexão criada pelo modo de simulação (sem Meta real). */
  simulada: boolean;
  /**
   * Origem da conexão: 'meta' = API oficial (Cloud API/Embedded Signup);
   * 'evolution' = WhatsApp não-oficial via Evolution API (self-host).
   */
  provider: 'meta' | 'evolution';
  /**
   * WhatsApp em modo coexistência: o número roda ao mesmo tempo no app WhatsApp
   * Business (celular) e na Cloud API. Recebemos echoes do app + histórico.
   */
  coexistence: boolean;
  expiraEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ChannelMessageDTO {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  tipo: MessageType;
  texto: string | null;
  status: MessageStatus | null;
  /** Saída gerada pelo piloto automático (não digitada pelo dono). */
  automatica: boolean;
  /** Anexos/metadados normalizados (urls de mídia, coordenadas, etc.). */
  anexos: ChannelAnexo[];
  enviadaEm: string;
  criadoEm: string;
}

export interface ChannelAnexo {
  tipo: MessageType;
  url?: string;
  nome?: string;
  mime?: string;
}

export interface ConversationDTO {
  id: string;
  connectionId: string;
  platform: ChannelPlatform;
  /** Identificador do interlocutor na plataforma (telefone E.164, PSID, IGSID). */
  externalUserId: string;
  nomeContato: string | null;
  /** Vínculos opcionais com o CRM. */
  contatoId: string | null;
  cardId: string | null;
  status: ConversationStatus;
  naoLidas: number;
  /** Piloto automático ligado: o agente responde o lead sozinho. */
  autopilot: boolean;
  /** Diretriz do dono para o piloto (tom/limites), quando definida. */
  autopilotInstrucao: string | null;
  ultimaPrevia: string | null;
  ultimaMensagemEm: string | null;
  criadoEm: string;
}

/** Uma conversa do inbox enriquecida com o nome da conta que a recebeu. */
export interface InboxItemDTO extends ConversationDTO {
  conexaoNome: string;
}

/** O inbox completo: conversas + as conexões disponíveis (para filtros/labels). */
export interface InboxDTO {
  conversas: InboxItemDTO[];
  conexoes: ChannelConnectionDTO[];
}

/* ------------------------------------------------------------------ *
 * Schemas (validação nas rotas)
 * ------------------------------------------------------------------ */

export const ChannelPlatformSchema = z.enum(CHANNEL_PLATFORMS);

/** Corpo aceito pelo endpoint de simulação (testar o inbox sem a Meta real). */
export const SimularMensagemSchema = z.object({
  platform: ChannelPlatformSchema.default('whatsapp'),
  /** Nome do lead fictício (o interlocutor). */
  de: z.string().min(1).max(120).default('Lead de teste'),
  /** Identificador do interlocutor; gerado se omitido. */
  externalUserId: z.string().min(1).max(120).optional(),
  texto: z.string().min(1).max(4000),
  /**
   * 'entrada' = mensagem do lead; 'saida' = simula o dono respondendo pelo app
   * WhatsApp Business (echo de coexistência).
   */
  direction: z.enum(MESSAGE_DIRECTIONS).default('entrada'),
});
export type SimularMensagemInput = z.infer<typeof SimularMensagemSchema>;

/** Corpo do envio manual de uma mensagem de texto pela plataforma. */
export const EnviarMensagemSchema = z.object({
  texto: z.string().min(1).max(4096),
});
export type EnviarMensagemInput = z.infer<typeof EnviarMensagemSchema>;

/**
 * Corpo (opcional) do rascunho assistido por IA. `instrucao` deixa o dono
 * orientar o tom/conteúdo da sugestão (ex.: "ofereça 10% de desconto").
 */
export const RascunharSchema = z.object({
  instrucao: z.string().max(500).optional(),
});
export type RascunharInput = z.infer<typeof RascunharSchema>;

/* ------------------------------------------------------------------ *
 * Normalização de webhooks
 *
 * Cada plataforma manda um envelope diferente. Reduzimos todos a um par comum
 * { mensagens, contatos } que o repositório (src/lib/channels.ts) consome sem
 * precisar saber de qual plataforma veio.
 *
 * COEXISTÊNCIA (WhatsApp): além de `messages` (entrada), tratamos os webhooks
 * que só existem quando o número roda ao mesmo tempo no app WhatsApp Business e
 * na Cloud API:
 *  - `smb_message_echoes` → mensagens que o DONO enviou pelo celular (saída);
 *  - `history`            → conversas anteriores importadas no onboarding;
 *  - `smb_app_state_sync` → contatos do app (enriquece o nome do interlocutor).
 * No Messenger/Instagram, mensagens com `is_echo` (enviadas pela Página) também
 * viram saída — o mesmo princípio de inbox unificado.
 * ------------------------------------------------------------------ */

/** Uma mensagem normalizada, pronta para ser persistida. */
export interface NormalizedMessage {
  platform: ChannelPlatform;
  /** Id externo da conta que recebeu/enviou (casa com ChannelConnectionDTO.externalId). */
  connectionExternalId: string;
  /** Id do interlocutor (o cliente) na plataforma — nunca o número do negócio. */
  externalUserId: string;
  /** Nome do interlocutor, quando a plataforma informa. */
  nomeContato: string | null;
  /** Id da mensagem na plataforma — usado para dedupe idempotente. */
  externalMessageId: string;
  tipo: MessageType;
  texto: string | null;
  anexos: ChannelAnexo[];
  /** Momento de envio informado pela plataforma (epoch ms). */
  enviadaEm: number;
  /** Entrada (do cliente) ou saída (do dono, inclusive pelo app móvel). */
  direction: MessageDirection;
  /** Veio do `history` (mensagem antiga): não notifica nem mexe no badge. */
  historico: boolean;
  /** Saída gerada pelo piloto automático (default false). */
  automatica?: boolean;
}

/** Um contato sincronizado do app (smb_app_state_sync). */
export interface NormalizedContact {
  platform: ChannelPlatform;
  connectionExternalId: string;
  /** Telefone do contato (somente dígitos). */
  phone: string;
  nome: string | null;
  action: 'add' | 'remove';
}

/** O resultado de normalizar um webhook: mensagens + atualizações de contato. */
export interface NormalizedWebhook {
  mensagens: NormalizedMessage[];
  contatos: NormalizedContact[];
}

/** Mapeia o `type` cru do WhatsApp/IG/Messenger para o nosso MessageType. */
function tipoDe(raw: string | undefined): MessageType {
  switch (raw) {
    case 'text':
      return 'texto';
    case 'image':
      return 'imagem';
    case 'audio':
    case 'voice':
      return 'audio';
    case 'video':
      return 'video';
    case 'document':
    case 'file':
      return 'arquivo';
    case 'sticker':
      return 'sticker';
    case 'location':
      return 'localizacao';
    default:
      return raw ? 'outro' : 'texto';
  }
}

/** Converte um timestamp (segundos OU ms, string OU número) em epoch ms. */
function paraMs(ts: unknown): number {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return Date.parse(new Date().toISOString());
  // WhatsApp manda segundos; Messenger/IG mandam ms. Heurística por magnitude.
  return n < 1e12 ? n * 1000 : n;
}

/** Reduz um telefone a só dígitos (compara wa_id com display_phone_number). */
function soDigitos(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\D/g, '') : '';
}

/**
 * Normaliza o payload bruto de um webhook da Meta. Suporta WhatsApp Cloud API
 * (`object: whatsapp_business_account`, incluindo os eventos de coexistência),
 * Messenger (`object: page`) e Instagram (`object: instagram`). Eventos não
 * tratados (status de entrega, etc.) são ignorados.
 */
export function normalizarWebhook(payload: unknown): NormalizedWebhook {
  const vazio: NormalizedWebhook = { mensagens: [], contatos: [] };
  if (!payload || typeof payload !== 'object') return vazio;
  const p = payload as Record<string, unknown>;
  const object = typeof p.object === 'string' ? p.object : '';
  const entries = Array.isArray(p.entry) ? (p.entry as Record<string, unknown>[]) : [];

  if (object === 'whatsapp_business_account') return normalizarWhatsApp(entries);
  if (object === 'page') return normalizarMessaging(entries, 'messenger');
  if (object === 'instagram') return normalizarMessaging(entries, 'instagram');
  return vazio;
}

/** WhatsApp Cloud API: roteia por `change.field` (messages / echoes / history / state_sync). */
function normalizarWhatsApp(entries: Record<string, unknown>[]): NormalizedWebhook {
  const mensagens: NormalizedMessage[] = [];
  const contatos: NormalizedContact[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes)
      ? (entry.changes as Record<string, unknown>[])
      : [];
    for (const change of changes) {
      const field = typeof change.field === 'string' ? change.field : '';
      const value = (change.value ?? {}) as Record<string, unknown>;
      const metadata = (value.metadata ?? {}) as Record<string, unknown>;
      const phoneNumberId =
        typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : '';
      if (!phoneNumberId) continue;
      const numeroNegocio = soDigitos(metadata.display_phone_number);

      // Mensagens recebidas (entrada).
      if (field === 'messages' || Array.isArray(value.messages)) {
        const nomes = mapaDeNomes(value);
        for (const m of arr(value.messages)) {
          const msg = msgWhatsApp(m, phoneNumberId, {
            externalUserId: soDigitos(m.from),
            nome: nomes.get(soDigitos(m.from)) ?? null,
            direction: 'entrada',
            historico: false,
          });
          if (msg) mensagens.push(msg);
        }
      }

      // Echoes: o dono enviou pelo app WhatsApp Business (saída).
      if (field === 'smb_message_echoes' || Array.isArray(value.message_echoes)) {
        for (const m of arr(value.message_echoes)) {
          const msg = msgWhatsApp(m, phoneNumberId, {
            externalUserId: soDigitos(m.to),
            nome: null,
            direction: 'saida',
            historico: false,
          });
          if (msg) mensagens.push(msg);
        }
      }

      // Histórico importado no onboarding (mensagens antigas, entrada e saída).
      if (field === 'history' || Array.isArray(value.history)) {
        for (const chunk of arr(value.history)) {
          for (const thread of arr(chunk.threads)) {
            const cliente = soDigitos(thread.id ?? thread.thread);
            for (const m of arr(thread.messages)) {
              const doNegocio = soDigitos(m.from) === numeroNegocio && numeroNegocio !== '';
              const msg = msgWhatsApp(m, phoneNumberId, {
                externalUserId: cliente || soDigitos(doNegocio ? m.to : m.from),
                nome: null,
                direction: doNegocio ? 'saida' : 'entrada',
                historico: true,
              });
              if (msg) mensagens.push(msg);
            }
          }
        }
      }

      // Sincronização de contatos do app.
      if (field === 'smb_app_state_sync' || Array.isArray(value.state_sync)) {
        for (const item of arr(value.state_sync)) {
          const c = (item.contact ?? item) as Record<string, unknown>;
          const phone = soDigitos(c.phone_number ?? c.wa_id);
          if (!phone) continue;
          const nome =
            (typeof c.full_name === 'string' && c.full_name) ||
            (typeof c.first_name === 'string' && c.first_name) ||
            null;
          contatos.push({
            platform: 'whatsapp',
            connectionExternalId: phoneNumberId,
            phone,
            nome,
            action: item.action === 'remove' ? 'remove' : 'add',
          });
        }
      }
    }
  }
  return { mensagens, contatos };
}

/** Monta uma NormalizedMessage de WhatsApp a partir de um item cru. */
function msgWhatsApp(
  m: Record<string, unknown>,
  phoneNumberId: string,
  extra: {
    externalUserId: string;
    direction: MessageDirection;
    historico: boolean;
    nome?: string | null;
  },
): NormalizedMessage | null {
  const id = typeof m.id === 'string' ? m.id : '';
  if (!id || !extra.externalUserId) return null;
  const tipo = tipoDe(typeof m.type === 'string' ? m.type : undefined);
  return {
    platform: 'whatsapp',
    connectionExternalId: phoneNumberId,
    externalUserId: extra.externalUserId,
    nomeContato: extra.nome ?? null,
    externalMessageId: id,
    tipo,
    texto: extrairTextoWhatsApp(m, tipo),
    anexos: [],
    enviadaEm: paraMs(m.timestamp),
    direction: extra.direction,
    historico: extra.historico,
  };
}

/** Mapa wa_id (dígitos) → nome de perfil, vindo de value.contacts. */
function mapaDeNomes(value: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of arr(value.contacts)) {
    const waId = soDigitos(c.wa_id);
    const profile = (c.profile ?? {}) as Record<string, unknown>;
    const nome = typeof profile.name === 'string' ? profile.name : '';
    if (waId && nome) out.set(waId, nome);
  }
  return out;
}

function extrairTextoWhatsApp(
  m: Record<string, unknown>,
  tipo: MessageType,
): string | null {
  if (tipo === 'texto') {
    const text = (m.text ?? {}) as Record<string, unknown>;
    return typeof text.body === 'string' ? text.body : null;
  }
  // Mensagens de mídia podem trazer legenda; capturamos quando houver.
  const candidato = (m.image ?? m.video ?? m.document ?? {}) as Record<string, unknown>;
  return typeof candidato.caption === 'string' ? candidato.caption : null;
}

/** Messenger e Instagram: entry[].messaging[].{sender,recipient,message}. */
function normalizarMessaging(
  entries: Record<string, unknown>[],
  platform: Extract<ChannelPlatform, 'messenger' | 'instagram'>,
): NormalizedWebhook {
  const mensagens: NormalizedMessage[] = [];
  for (const entry of entries) {
    const pageOuIgId = typeof entry.id === 'string' ? entry.id : '';
    if (!pageOuIgId) continue;
    for (const evt of arr(entry.messaging)) {
      const message = (evt.message ?? {}) as Record<string, unknown>;
      const mid = typeof message.mid === 'string' ? message.mid : '';
      if (!mid) continue;
      const sender = (evt.sender ?? {}) as Record<string, unknown>;
      const recipient = (evt.recipient ?? {}) as Record<string, unknown>;

      // Echo = a Página enviou; o interlocutor é o destinatário (saída).
      const echo = message.is_echo === true;
      const externalUserId = echo
        ? (typeof recipient.id === 'string' ? recipient.id : '')
        : (typeof sender.id === 'string' ? sender.id : '');
      if (!externalUserId) continue;

      const attachments = arr(message.attachments).map(toAnexo);
      const texto = typeof message.text === 'string' ? message.text : null;
      const tipo = texto ? 'texto' : (attachments[0]?.tipo ?? 'outro');

      mensagens.push({
        platform,
        connectionExternalId: pageOuIgId,
        externalUserId,
        nomeContato: null,
        externalMessageId: mid,
        tipo,
        texto,
        anexos: attachments,
        enviadaEm: paraMs(evt.timestamp),
        direction: echo ? 'saida' : 'entrada',
        historico: false,
      });
    }
  }
  return { mensagens, contatos: [] };
}

function toAnexo(a: Record<string, unknown>): ChannelAnexo {
  const tipo = tipoDe(typeof a.type === 'string' ? a.type : undefined);
  const payload = (a.payload ?? {}) as Record<string, unknown>;
  const url = typeof payload.url === 'string' ? payload.url : undefined;
  return { tipo, url };
}

/** Acesso seguro a um array de objetos dentro do payload. */
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
