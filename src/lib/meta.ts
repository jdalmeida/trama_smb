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

/** Permissões pedidas no OAuth (usadas quando não há config_id de Embedded Signup). */
const SCOPES = [
  'public_profile',
  'business_management',
  'pages_show_list',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_messages',
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
