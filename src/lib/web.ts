/**
 * Helpers puros usados pelas tools de internet das personas (app/steps/web.ts).
 * São funções sem I/O para poderem ser testadas em isolamento.
 */

/** Resultado da validação de uma URL fornecida pelo agente. */
export type UrlValidada =
  | { ok: true; url: URL }
  | { ok: false; erro: string };

/**
 * Valida que a URL é pública e segura de buscar (guarda anti-SSRF):
 * apenas http/https e nunca hosts internos (localhost, IPs privados, .local).
 */
export function validarUrlPublica(entrada: string): UrlValidada {
  let url: URL;
  try {
    url = new URL(entrada);
  } catch {
    return { ok: false, erro: 'URL inválida' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, erro: 'Apenas URLs http(s) são permitidas' };
  }

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    ehIpPrivado(host)
  ) {
    return { ok: false, erro: 'URLs internas/privadas não são permitidas' };
  }

  return { ok: true, url };
}

/** Detecta IPs de loopback, link-local e faixas privadas (IPv4 e IPv6 comuns). */
function ehIpPrivado(host: string): boolean {
  // IPv6 (URL.hostname entrega sem colchetes)
  if (host.includes(':')) {
    return (
      host === '::1' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    );
  }

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Converte HTML numa versão texto legível para o agente: remove script/style/
 * head/nav/footer, troca tags por quebras, decodifica entidades comuns e
 * colapsa espaço em branco. Trunca em `maxChars` (com marcador).
 */
export function htmlParaTexto(html: string, maxChars = 18_000): string {
  let texto = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>(?=.)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  texto = decodificarEntidades(texto)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (texto.length > maxChars) {
    texto = `${texto.slice(0, maxChars)}\n\n[conteúdo truncado]`;
  }
  return texto;
}

/** Decodifica as entidades HTML mais comuns (suficiente para leitura). */
function decodificarEntidades(texto: string): string {
  const mapa: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  return texto
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (e) => mapa[e] ?? e)
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : ' ';
    });
}

/** Extrai o <title> de um HTML, se houver. */
export function extrairTitulo(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const titulo = decodificarEntidades(m[1]).replace(/\s+/g, ' ').trim();
  return titulo.length > 0 ? titulo : undefined;
}

/** Normaliza um CNPJ para 14 dígitos, ou null se o formato for inválido. */
export function normalizarCnpj(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, '');
  return digitos.length === 14 ? digitos : null;
}

/** Recorta um trecho de texto para listagens (busca na memória). */
export function fazerSnippet(texto: string, maxChars = 280): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length <= maxChars ? plano : `${plano.slice(0, maxChars)}…`;
}
