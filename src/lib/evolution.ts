import {
  type ChannelAnexo,
  type MessageType,
  type NormalizedMessage,
} from '@/src/domain/channels';

/**
 * Cliente da Evolution API (WhatsApp não-oficial, self-host) + normalização dos
 * webhooks dela para o formato comum NormalizedMessage.
 *
 * A Evolution mantém a sessão do WhatsApp Web (via Baileys) no SERVIDOR DELA —
 * por isso o Trama pode continuar 100% serverless na Vercel: aqui só falamos
 * REST (criar instância, pegar QR, status) e recebemos webhooks.
 *
 * Coexistência "de graça": mensagens que o dono envia pelo celular chegam com
 * `key.fromMe = true` → viram saída no inbox, sem configuração extra.
 *
 * Requer EVOLUTION_API_URL e EVOLUTION_API_KEY. Sem elas, evolutionConfigurado()
 * é false e as rotas respondem de forma amigável.
 */

function baseUrl(): string | undefined {
  const u = process.env.EVOLUTION_API_URL;
  return u ? u.replace(/\/$/, '') : undefined;
}
function apiKey(): string | undefined {
  return process.env.EVOLUTION_API_KEY || undefined;
}

/** Token próprio que validamos no webhook (a Evolution o devolve via query). */
export function evolutionWebhookToken(): string {
  return process.env.EVOLUTION_WEBHOOK_TOKEN || 'dev-evolution-token';
}

export function evolutionConfigurado(): boolean {
  return Boolean(baseUrl() && apiKey());
}

/** Nome da instância da Evolution para um negócio (1 número por negócio no MVP). */
export function instanceNameDe(businessId: string): string {
  return `trama-${businessId}`;
}

async function evoFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = baseUrl();
  const key = apiKey();
  if (!url || !key) throw new Error('Evolution API não configurada.');
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as
    | { message?: unknown; error?: unknown; response?: { message?: unknown } }
    | null;
  if (!res.ok) {
    // Inclui o corpo da resposta no erro. Um 400 do sendText costuma vir como
    // `{ exists: false, jid, number }` (número não existe no WhatsApp) — sem
    // isto o erro virava só "Evolution respondeu 400", sem pista da causa.
    const detalhe =
      (typeof json?.response?.message === 'string' && json.response.message) ||
      (typeof json?.message === 'string' && json.message) ||
      (json ? JSON.stringify(json) : '');
    throw new Error(
      `Evolution respondeu ${res.status}${detalhe ? `: ${detalhe}` : ''}`,
    );
  }
  return json;
}

const EVENTOS = ['MESSAGES_UPSERT'];

/**
 * Cria a instância (idempotente: ignora "já existe") já apontando o webhook para
 * o Trama. integration WHATSAPP-BAILEYS = WhatsApp Web não-oficial.
 */
export async function criarInstancia(
  instanceName: string,
  webhookUrl: string,
): Promise<void> {
  try {
    await evoFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: EVENTOS,
        },
      }),
    });
  } catch (err) {
    // "already in use"/"exists" → segue; garante o webhook abaixo.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!msg.includes('use') && !msg.includes('exist') && !msg.includes('already')) {
      throw err;
    }
  }
  // Garante a config de webhook mesmo para instância pré-existente (best-effort).
  try {
    await evoFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: EVENTOS,
        },
      }),
    });
  } catch {
    // já configurado no create — ok
  }
}

/** Pega o QR (base64) para parear o WhatsApp. */
export async function conectarInstancia(
  instanceName: string,
): Promise<{ base64: string | null; code: string | null; pairingCode: string | null }> {
  const data = (await evoFetch(
    `/instance/connect/${encodeURIComponent(instanceName)}`,
  )) as { base64?: string; code?: string; pairingCode?: string };
  return {
    base64: data.base64 ?? null,
    code: data.code ?? null,
    pairingCode: data.pairingCode ?? null,
  };
}

/** Estado da conexão: 'open' (pareado), 'connecting', 'close'. */
export async function estadoConexao(instanceName: string): Promise<string> {
  const data = (await evoFetch(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  )) as { instance?: { state?: string }; state?: string };
  return data.instance?.state ?? data.state ?? 'close';
}

/**
 * Envia uma mensagem de texto pela instância (POST /message/sendText/{instance}).
 * `numero` é o telefone do destinatário (só dígitos, com DDI). Retorna o id da
 * mensagem (key.id) para dedupe com o echo que a própria Evolution reentrega no
 * webhook (messages.upsert com fromMe=true).
 */
export async function enviarTexto(
  instanceName: string,
  numero: string,
  texto: string,
): Promise<string | null> {
  const data = (await evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({ number: numero, text: texto }),
  })) as { key?: { id?: string }; messageId?: string };
  return data.key?.id ?? data.messageId ?? null;
}

/* ------------------------------------------------------------------ *
 * Normalização do webhook
 * ------------------------------------------------------------------ */

/** Mapeia o messageType da Evolution (Baileys) para o nosso MessageType. */
function tipoEvolution(messageType: string | undefined, message: Record<string, unknown>): MessageType {
  if (message.conversation || message.extendedTextMessage) return 'texto';
  switch (messageType) {
    case 'conversation':
    case 'extendedTextMessage':
      return 'texto';
    case 'imageMessage':
      return 'imagem';
    case 'audioMessage':
      return 'audio';
    case 'videoMessage':
      return 'video';
    case 'documentMessage':
      return 'arquivo';
    case 'stickerMessage':
      return 'sticker';
    case 'locationMessage':
      return 'localizacao';
    default:
      return 'outro';
  }
}

function textoEvolution(message: Record<string, unknown>): string | null {
  if (typeof message.conversation === 'string') return message.conversation;
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  // legendas de mídia
  for (const k of ['imageMessage', 'videoMessage', 'documentMessage']) {
    const m = message[k] as Record<string, unknown> | undefined;
    if (m && typeof m.caption === 'string') return m.caption;
  }
  return null;
}

function paraMs(ts: unknown): number {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return Date.parse(new Date().toISOString());
  return n < 1e12 ? n * 1000 : n;
}

/**
 * Normaliza o payload de webhook da Evolution (evento messages.upsert) para a
 * lista de NormalizedMessage. Ignora grupos (@g.us) e broadcast/status; o
 * connectionExternalId é o nome da instância (casa com a conexão salva).
 */
export function normalizarEvolution(payload: unknown): NormalizedMessage[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const event = typeof p.event === 'string' ? p.event.toLowerCase() : '';
  if (event && event !== 'messages.upsert') return [];

  const instance = typeof p.instance === 'string' ? p.instance : '';
  if (!instance) return [];

  // data pode ser um objeto único ou uma lista de mensagens.
  const itens = Array.isArray(p.data)
    ? (p.data as Record<string, unknown>[])
    : p.data
      ? [p.data as Record<string, unknown>]
      : [];

  const out: NormalizedMessage[] = [];
  for (const item of itens) {
    const key = (item.key ?? {}) as Record<string, unknown>;
    const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
    const id = typeof key.id === 'string' ? key.id : '';
    if (!remoteJid || !id) continue;
    // Ignora apenas o que NÃO é conversa 1:1: grupos (@g.us), listas de
    // transmissão/status (@broadcast) e canais (@newsletter). Aceita tanto
    // @s.whatsapp.net quanto @lid — o WhatsApp passou a entregar conversas
    // individuais com JID @lid, e o whitelist antigo as descartava em silêncio.
    if (
      remoteJid.endsWith('@g.us') ||
      remoteJid.endsWith('@broadcast') ||
      remoteJid.endsWith('@newsletter')
    ) {
      continue;
    }

    // O WhatsApp passou a endereçar conversas 1:1 por @lid (Linked ID), que NÃO
    // é um número discável: enviar para ele faz a Evolution responder 400
    // (whatsappNumber → exists:false). O telefone real (…@s.whatsapp.net) vem em
    // key.remoteJidAlt — preferimos sempre ele como chave da conversa, para o
    // envio funcionar e o mesmo contato não duplicar entre @lid e telefone.
    const remoteJidAlt =
      typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '';
    const jidContato =
      remoteJid.endsWith('@lid') && remoteJidAlt.endsWith('@s.whatsapp.net')
        ? remoteJidAlt
        : remoteJid;

    const externalUserId = jidContato.split('@')[0].replace(/\D/g, '');
    if (!externalUserId) continue;

    if (jidContato.endsWith('@lid')) {
      // Não veio o telefone real: a conversa entra no inbox, mas o envio vai
      // falhar (400) até a Evolution resolver @lid → telefone. Logamos as chaves
      // do `key` cru para confirmar quais campos a sua versão entrega.
      console.warn(
        '[normalizarEvolution] mensagem @lid sem telefone real — envio falhará',
        { remoteJid, camposKey: Object.keys(key) },
      );
    }

    const fromMe = key.fromMe === true;
    const message = (item.message ?? {}) as Record<string, unknown>;
    const messageType = typeof item.messageType === 'string' ? item.messageType : undefined;
    const pushName = typeof item.pushName === 'string' ? item.pushName : null;
    const anexos: ChannelAnexo[] = [];

    out.push({
      platform: 'whatsapp',
      connectionExternalId: instance,
      externalUserId,
      nomeContato: fromMe ? null : pushName,
      externalMessageId: id,
      tipo: tipoEvolution(messageType, message),
      texto: textoEvolution(message),
      anexos,
      enviadaEm: paraMs(item.messageTimestamp),
      direction: fromMe ? 'saida' : 'entrada',
      historico: false,
    });
  }
  return out;
}
