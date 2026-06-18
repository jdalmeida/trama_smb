import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ChannelPlatform } from '@/src/domain/channels';

/**
 * Integração com as APIs da Meta (Graph API) para a fundação omnichannel.
 *
 * Encapsula TODO o acesso a env vars e à Graph API, para que rotas e libs não
 * precisem saber de detalhes da Meta. Quando as credenciais não estão
 * configuradas (caso atual — sem app Meta ainda), as funções degradam
 * graciosamente: `metaConfigurado()` retorna false e o app oferece o modo de
 * simulação no lugar do OAuth real.
 *
 * Login = Facebook Login for Business (Embedded Signup). O dono autoriza e a
 * Meta devolve um token com o qual descobrimos as contas (Páginas/IG/WABA) e
 * criamos as `channel_connections`.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Permissões pedidas no OAuth (usadas quando não há config_id de Embedded
 * Signup; com config_id as permissões vêm da configuração do app no painel da
 * Meta — inclua lá as de publicação também). As permissões de publicação de
 * feed (`pages_manage_posts`, `instagram_content_publish`) exigem App Review
 * para produção; veja docs/omnichannel-setup.md.
 */
const SCOPES = [
  'public_profile',
  'business_management',
  'pages_show_list',
  'pages_messaging',
  // Necessário para assinar a Página nos webhooks (subscribed_apps); sem ele a
  // Meta não entrega os eventos de mensagem da Página/Instagram.
  'pages_manage_metadata',
  // Publicar no feed da Página (posts) e ler engajamento dos posts.
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_messages',
  // Publicar no feed do Instagram (fluxo de container de mídia).
  'instagram_content_publish',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const;

function appId(): string | undefined {
  return process.env.META_APP_ID || undefined;
}
function appSecret(): string | undefined {
  return process.env.META_APP_SECRET || undefined;
}

/** True quando há app Meta configurado (App ID + Secret). */
export function metaConfigurado(): boolean {
  return Boolean(appId() && appSecret());
}

/** Verify token do webhook (definido por nós e cadastrado no painel da Meta). */
export function webhookVerifyToken(): string | undefined {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || undefined;
}

/** Base pública do app para montar o redirect_uri do OAuth. */
export function redirectUri(req: Request): string {
  const base =
    process.env.META_OAUTH_REDIRECT_BASE ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(req.url).origin;
  return `${base.replace(/\/$/, '')}/api/channels/callback`;
}

/* ------------------------------------------------------------------ *
 * State assinado (CSRF do OAuth)
 *
 * O `state` carrega o businessId e um nonce, assinado com HMAC(APP_SECRET).
 * No callback validamos a assinatura antes de confiar no conteúdo.
 * ------------------------------------------------------------------ */

interface OAuthState {
  businessId: string;
  platform: ChannelPlatform;
  nonce: string;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function assinarState(businessId: string, platform: ChannelPlatform): string {
  const secret = appSecret() ?? 'dev-secret';
  const payload: OAuthState = { businessId, platform, nonce: randomBytes(8).toString('hex') };
  const corpo = b64url(Buffer.from(JSON.stringify(payload)));
  const assinatura = b64url(createHmac('sha256', secret).update(corpo).digest());
  return `${corpo}.${assinatura}`;
}

export function verificarState(state: string | null): OAuthState | null {
  if (!state || !state.includes('.')) return null;
  const [corpo, assinatura] = state.split('.');
  const secret = appSecret() ?? 'dev-secret';
  const esperada = b64url(createHmac('sha256', secret).update(corpo).digest());
  if (!seguraIgual(assinatura, esperada)) return null;
  try {
    const json = Buffer.from(corpo.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const parsed = JSON.parse(json) as OAuthState;
    if (!parsed.businessId || !parsed.platform) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Comparação de strings em tempo constante (evita timing attacks). */
function seguraIgual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* ------------------------------------------------------------------ *
 * OAuth
 * ------------------------------------------------------------------ */

/** Monta a URL de autorização (Facebook Login for Business). */
export function urlAutorizacao(state: string, redirect: string): string {
  const params = new URLSearchParams({
    client_id: appId() ?? '',
    redirect_uri: redirect,
    state,
    response_type: 'code',
  });
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) {
    // Embedded Signup / Login for Business: as permissões vêm da configuração.
    params.set('config_id', configId);
  } else {
    params.set('scope', SCOPES.join(','));
  }
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Troca o `code` por um token de longa duração (~60 dias). */
export async function trocarCodePorToken(
  code: string,
  redirect: string,
): Promise<{ token: string; expiraEm: Date | null }> {
  if (!metaConfigurado()) throw new Error('Integração Meta não configurada.');

  const curto = new URL(`${GRAPH}/oauth/access_token`);
  curto.searchParams.set('client_id', appId()!);
  curto.searchParams.set('client_secret', appSecret()!);
  curto.searchParams.set('redirect_uri', redirect);
  curto.searchParams.set('code', code);
  const r1 = (await getJson(curto.toString())) as { access_token?: string };
  if (!r1.access_token) throw new Error('Falha ao obter token da Meta.');

  // Troca pelo token de longa duração.
  const longo = new URL(`${GRAPH}/oauth/access_token`);
  longo.searchParams.set('grant_type', 'fb_exchange_token');
  longo.searchParams.set('client_id', appId()!);
  longo.searchParams.set('client_secret', appSecret()!);
  longo.searchParams.set('fb_exchange_token', r1.access_token);
  const r2 = (await getJson(longo.toString())) as {
    access_token?: string;
    expires_in?: number;
  };
  const token = r2.access_token ?? r1.access_token;
  const expiraEm = r2.expires_in
    ? new Date(Date.now() + r2.expires_in * 1000)
    : null;
  return { token, expiraEm };
}

/* ------------------------------------------------------------------ *
 * Descoberta de contas
 * ------------------------------------------------------------------ */

export interface ContaDescoberta {
  platform: ChannelPlatform;
  externalId: string;
  nomeExibicao: string;
  accessToken: string;
  meta: Record<string, unknown>;
}

/**
 * Descobre as contas conectáveis a partir do token do usuário. Best-effort: cada
 * bloco (Páginas/IG, WABAs) é tentado de forma independente, então uma falha
 * parcial ainda retorna o que deu certo.
 */
export async function descobrirContas(token: string): Promise<ContaDescoberta[]> {
  const contas: ContaDescoberta[] = [];
  await Promise.all([
    descobrirPaginas(token, contas),
    descobrirWhatsApp(token, contas),
  ]);
  return contas;
}

/** Páginas do Facebook → Messenger; e a conta IG vinculada → Instagram. */
async function descobrirPaginas(token: string, out: ContaDescoberta[]): Promise<void> {
  try {
    const url = new URL(`${GRAPH}/me/accounts`);
    url.searchParams.set(
      'fields',
      'id,name,access_token,instagram_business_account{id,username}',
    );
    url.searchParams.set('access_token', token);
    const data = (await getJson(url.toString())) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
    };
    for (const page of data.data ?? []) {
      out.push({
        platform: 'messenger',
        externalId: page.id,
        nomeExibicao: page.name,
        accessToken: page.access_token,
        meta: { pageId: page.id },
      });
      const ig = page.instagram_business_account;
      if (ig?.id) {
        out.push({
          platform: 'instagram',
          externalId: ig.id,
          nomeExibicao: ig.username ? `@${ig.username}` : page.name,
          accessToken: page.access_token,
          meta: { pageId: page.id, igId: ig.id },
        });
      }
      // Assina a Página nos webhooks de mensagem (Messenger + Instagram
      // vinculado). Best-effort: uma falha aqui não impede salvar a conexão,
      // mas é logada porque sem isso nenhuma mensagem chega.
      try {
        await assinarPaginaWebhooks(page.id, page.access_token);
      } catch (err) {
        console.warn('[descobrirPaginas] falha ao assinar webhooks da Página', {
          pageId: page.id,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch {
    // Permissão ausente ou sem páginas — segue sem Messenger/Instagram.
  }
}

/** WABAs do usuário → cada número vira uma conexão WhatsApp. */
async function descobrirWhatsApp(token: string, out: ContaDescoberta[]): Promise<void> {
  try {
    const negocios = new URL(`${GRAPH}/me/businesses`);
    negocios.searchParams.set('fields', 'id,name');
    negocios.searchParams.set('access_token', token);
    const bizData = (await getJson(negocios.toString())) as {
      data?: Array<{ id: string; name: string }>;
    };
    for (const biz of bizData.data ?? []) {
      const wabas = new URL(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts`);
      wabas.searchParams.set(
        'fields',
        'id,name,phone_numbers{id,display_phone_number,verified_name}',
      );
      wabas.searchParams.set('access_token', token);
      const wabaData = (await getJson(wabas.toString())) as {
        data?: Array<{
          id: string;
          name?: string;
          phone_numbers?: {
            data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
          };
        }>;
      };
      for (const waba of wabaData.data ?? []) {
        for (const phone of waba.phone_numbers?.data ?? []) {
          out.push({
            platform: 'whatsapp',
            externalId: phone.id,
            nomeExibicao:
              phone.verified_name || phone.display_phone_number || waba.name || 'WhatsApp',
            accessToken: token,
            meta: { wabaId: waba.id, businessId: biz.id, phoneNumberId: phone.id },
          });
        }
      }
    }
  } catch {
    // Permissão ausente ou sem WABA — segue sem WhatsApp.
  }
}

/* ------------------------------------------------------------------ *
 * WhatsApp — conexão direta (sem Embedded Signup) e Embedded Signup
 * ------------------------------------------------------------------ */

/** Lê os dados de um número do WhatsApp (valida o par phone_number_id + token). */
export async function verificarNumeroWhatsApp(
  phoneNumberId: string,
  token: string,
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
  const url = new URL(`${GRAPH}/${phoneNumberId}`);
  url.searchParams.set('fields', 'display_phone_number,verified_name');
  url.searchParams.set('access_token', token);
  const data = (await getJson(url.toString())) as {
    display_phone_number?: string;
    verified_name?: string;
  };
  return {
    displayPhoneNumber: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
  };
}

/**
 * Assina este app na WABA para receber os webhooks daquele número
 * (POST /{waba-id}/subscribed_apps). Idempotente do lado da Meta.
 */
export async function assinarAppNaWaba(wabaId: string, token: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(json?.error?.message || `Falha ao assinar a WABA (${res.status})`);
  }
}

/**
 * Assina a Página nos webhooks de mensageria (POST /{page-id}/subscribed_apps).
 *
 * Esta é a etapa que faltava: sem assinar a Página, a Meta NÃO entrega os
 * webhooks de mensagens dela (nem do Instagram vinculado) — por isso "conecta
 * mas não chega conversa nenhuma". Usa o token da Página (page.access_token) e é
 * idempotente do lado da Meta. Requer o scope `pages_manage_metadata`.
 */
export async function assinarPaginaWebhooks(
  pageId: string,
  pageToken: string,
): Promise<void> {
  const url = new URL(`${GRAPH}/${pageId}/subscribed_apps`);
  url.searchParams.set(
    'subscribed_fields',
    'messages,messaging_postbacks,message_echoes,messaging_optins,messaging_referrals',
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${pageToken}` },
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(json?.error?.message || `Falha ao assinar a Página (${res.status})`);
  }
}

/**
 * Troca o `code` retornado pelo Embedded Signup (fluxo JS, sem redirect_uri)
 * por um token de integração do negócio. Diferente do OAuth por redirect, aqui
 * NÃO se envia redirect_uri.
 */
export async function trocarCodeEmbedded(code: string): Promise<string> {
  if (!metaConfigurado()) throw new Error('Integração Meta não configurada.');
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set('client_id', appId()!);
  url.searchParams.set('client_secret', appSecret()!);
  url.searchParams.set('code', code);
  const data = (await getJson(url.toString())) as { access_token?: string };
  if (!data.access_token) throw new Error('Falha ao obter token do Embedded Signup.');
  return data.access_token;
}

/* ------------------------------------------------------------------ *
 * Envio de mensagens (Cloud API / Send API)
 * ------------------------------------------------------------------ */

/**
 * Envia uma mensagem de texto pelo WhatsApp Cloud API
 * (POST /{phone-number-id}/messages). Retorna o `wamid` da mensagem — usado para
 * dedupe com o echo (`smb_message_echoes`) que volta no webhook.
 *
 * Observação: fora da janela de 24h de atendimento, a Meta exige um template
 * aprovado (não cobrimos aqui). Como resposta a um lead que escreveu, é sessão
 * normal de texto livre.
 */
export async function enviarTextoWhatsApp(
  phoneNumberId: string,
  token: string,
  to: string,
  texto: string,
): Promise<string | null> {
  const data = (await postJson(`${GRAPH}/${phoneNumberId}/messages`, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: texto, preview_url: true },
  })) as { messages?: Array<{ id?: string }> };
  return data.messages?.[0]?.id ?? null;
}

/**
 * Envia uma mensagem de texto pelo Messenger ou Instagram (Send API:
 * POST /{page-id|ig-id}/messages). Retorna o `message_id` (mid) para dedupe com
 * o echo (`is_echo`) que volta no webhook. `messaging_type: RESPONSE` é o modo
 * de resposta dentro da janela padrão de atendimento.
 */
export async function enviarTextoMessaging(
  contaId: string,
  token: string,
  recipientId: string,
  texto: string,
): Promise<string | null> {
  const data = (await postJson(`${GRAPH}/${contaId}/messages`, token, {
    recipient: { id: recipientId },
    messaging_type: 'RESPONSE',
    message: { text: texto },
  })) as { message_id?: string };
  return data.message_id ?? null;
}

/* ------------------------------------------------------------------ *
 * Publicação no feed (posts) — Facebook (Página) e Instagram
 *
 * Diferente do envio de DM, aqui publicamos um POST público no feed. Usa o
 * page access token (o mesmo já salvo nas conexões `messenger`/`instagram`).
 * ------------------------------------------------------------------ */

/**
 * Publica um post no feed da Página do Facebook. Com imagem usa
 * POST /{page-id}/photos (a imagem precisa estar numa URL pública); sem imagem,
 * POST /{page-id}/feed (texto). Retorna o id do post e, best-effort, o
 * permalink. Requer o page access token com a permissão `pages_manage_posts`.
 */
export async function publicarPostFacebook(
  pageId: string,
  pageToken: string,
  input: { mensagem: string; imageUrl?: string | null },
): Promise<{ externalPostId: string; permalink: string | null }> {
  if (input.imageUrl) {
    const data = (await postJson(`${GRAPH}/${pageId}/photos`, pageToken, {
      url: input.imageUrl,
      caption: input.mensagem,
      published: true,
    })) as { id?: string; post_id?: string };
    const postId = data.post_id || data.id || '';
    return { externalPostId: postId, permalink: await permalinkFacebook(postId, pageToken) };
  }
  const data = (await postJson(`${GRAPH}/${pageId}/feed`, pageToken, {
    message: input.mensagem,
  })) as { id?: string };
  const postId = data.id ?? '';
  return { externalPostId: postId, permalink: await permalinkFacebook(postId, pageToken) };
}

/** Busca best-effort o permalink de um post da Página. */
async function permalinkFacebook(postId: string, token: string): Promise<string | null> {
  if (!postId) return null;
  try {
    const url = new URL(`${GRAPH}/${postId}`);
    url.searchParams.set('fields', 'permalink_url');
    url.searchParams.set('access_token', token);
    const data = (await getJson(url.toString())) as { permalink_url?: string };
    return data.permalink_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Publica uma foto no feed do Instagram (fluxo de 2 passos da Graph API):
 *  1) cria um container de mídia (POST /{ig-id}/media com image_url + caption);
 *  2) publica o container (POST /{ig-id}/media_publish com creation_id).
 *
 * O Instagram EXIGE uma imagem em URL pública (image_url) — não publica texto
 * puro. Requer o token com a permissão `instagram_content_publish`.
 */
export async function publicarPostInstagram(
  igId: string,
  token: string,
  input: { caption: string; imageUrl: string },
): Promise<{ externalPostId: string; permalink: string | null }> {
  const container = (await postJson(`${GRAPH}/${igId}/media`, token, {
    image_url: input.imageUrl,
    caption: input.caption,
  })) as { id?: string };
  const creationId = container.id;
  if (!creationId) throw new Error('Instagram não devolveu o container de mídia.');

  const pub = (await postJson(`${GRAPH}/${igId}/media_publish`, token, {
    creation_id: creationId,
  })) as { id?: string };
  const mediaId = pub.id ?? '';
  return { externalPostId: mediaId, permalink: await permalinkInstagram(mediaId, token) };
}

/** Busca best-effort o permalink de uma mídia publicada no Instagram. */
async function permalinkInstagram(mediaId: string, token: string): Promise<string | null> {
  if (!mediaId) return null;
  try {
    const url = new URL(`${GRAPH}/${mediaId}`);
    url.searchParams.set('fields', 'permalink');
    url.searchParams.set('access_token', token);
    const data = (await getJson(url.toString())) as { permalink?: string };
    return data.permalink ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Webhook
 * ------------------------------------------------------------------ */

/**
 * Verifica a assinatura `x-hub-signature-256` do webhook (HMAC-SHA256 do corpo
 * cru com o APP_SECRET). Sem app secret configurado (dev/simulação), não há o
 * que verificar — retorna true e o chamador decide se exige.
 */
export function verificarAssinatura(rawBody: string, header: string | null): boolean {
  const secret = appSecret();
  if (!secret) return true; // não configurado: nada a verificar
  if (!header || !header.startsWith('sha256=')) return false;
  const esperado = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return seguraIgual(header.slice('sha256='.length), esperado);
}

/* ------------------------------------------------------------------ *
 * Util
 * ------------------------------------------------------------------ */

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = (await res.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!res.ok) {
    const msg = json?.error?.message || `Graph API respondeu ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** POST autenticado por Bearer na Graph API, com erro amigável. */
async function postJson(url: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!res.ok) {
    const msg = json?.error?.message || `Graph API respondeu ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
