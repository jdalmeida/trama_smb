import { generateText } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import {
  extrairTitulo,
  htmlParaTexto,
  normalizarCnpj,
  validarUrlPublica,
} from '@/src/lib/web';

/**
 * Tools de internet das personas e do CEO, como funções "use step"
 * (retryáveis, com I/O e observabilidade no Workflow DevKit).
 *
 * Regra do produto (LGPD): somente fontes públicas. Nada de dados privados,
 * nada de contato automatizado — as tools aqui leem o que está aberto na web.
 */

/** Resultado padronizado de um item de busca na web. */
export type ResultadoBusca = { title: string; url: string; snippet: string };

/** Saída da buscaWeb: lista de resultados e, no fallback, uma resposta sintetizada. */
export interface SaidaBuscaWeb {
  resultados: ResultadoBusca[];
  /** Presente quando a busca veio do fallback (modelo com busca embutida). */
  resposta?: string;
  /** Presente quando nenhum provedor de busca pôde atender. */
  aviso?: string;
}

/**
 * Busca na web (somente fontes públicas).
 *
 * 1) Com TAVILY_API_KEY configurada, usa a API da Tavily.
 * 2) Sem a chave (ou se a Tavily falhar), cai para um modelo com busca
 *    embutida via AI Gateway (Perplexity Sonar) — funciona com o OIDC já
 *    configurado, sem chave extra. Override: env BUSCA_WEB_MODEL.
 */
export async function buscaWeb(input: {
  query: string;
}): Promise<SaidaBuscaWeb> {
  'use step';
  console.log('[buscaWeb] início', { query: input.query });

  const viaTavily = await buscarTavily(input.query);
  if (viaTavily) {
    console.log('[buscaWeb] fim (tavily)', { quantidade: viaTavily.length });
    return { resultados: viaTavily };
  }

  try {
    const modelo = process.env.BUSCA_WEB_MODEL || 'perplexity/sonar';
    const r = await generateText({
      model: modelo,
      system:
        'Você é um buscador. Responda em português brasileiro, de forma factual e ' +
        'concisa, citando somente informações de fontes públicas. Não invente dados.',
      prompt: input.query,
    });
    const resultados: ResultadoBusca[] = r.sources
      .filter(
        (s): s is Extract<typeof s, { sourceType: 'url' }> =>
          s.sourceType === 'url',
      )
      .map((s) => ({ title: s.title ?? '', url: s.url, snippet: '' }));
    console.log('[buscaWeb] fim (fallback)', {
      modelo,
      fontes: resultados.length,
    });
    return { resultados, resposta: r.text };
  } catch (err) {
    console.error('[buscaWeb] fallback falhou', err);
    return {
      resultados: [],
      aviso:
        'Nenhum provedor de busca disponível no momento. Trabalhe com o que ' +
        'já tem e sinalize a limitação no entregável.',
    };
  }
}

/** Busca via Tavily; null quando não há chave ou em erro (aciona o fallback). */
async function buscarTavily(query: string): Promise<ResultadoBusca[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    });
    if (!res.ok) {
      console.log('[buscaWeb] tavily não-OK', { status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    }));
  } catch (err) {
    console.error('[buscaWeb] tavily erro', err);
    return null;
  }
}

/** Saída da leitura de uma página pública. */
export type SaidaLerPagina =
  | { ok: true; url: string; titulo?: string; texto: string }
  | { ok: false; erro: string };

/**
 * Lê uma página pública da web e devolve o texto principal (HTML limpo).
 * Só http(s) e hosts públicos (guarda anti-SSRF em validarUrlPublica).
 */
export async function lerPagina(input: {
  url: string;
}): Promise<SaidaLerPagina> {
  'use step';
  console.log('[lerPagina] início', { url: input.url });

  const validada = validarUrlPublica(input.url);
  if (!validada.ok) return { ok: false, erro: validada.erro };

  try {
    const res = await fetch(validada.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'TramaBot/1.0 (+https://trama.app) leitura de fontes públicas',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    if (!res.ok) {
      return { ok: false, erro: `A página respondeu com status ${res.status}` };
    }

    const tipo = res.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/xhtml/.test(tipo)) {
      return {
        ok: false,
        erro: `Conteúdo não textual (${tipo || 'tipo desconhecido'}) — só consigo ler páginas de texto/HTML`,
      };
    }

    // Limita a leitura a ~1,5 MB para não estourar o step com páginas enormes.
    const bruto = await res.text();
    const html = bruto.slice(0, 1_500_000);
    const texto = tipo.includes('text/plain')
      ? html.slice(0, 18_000)
      : htmlParaTexto(html);

    if (texto.length === 0) {
      return { ok: false, erro: 'A página não tem texto legível' };
    }

    console.log('[lerPagina] fim', { url: input.url, chars: texto.length });
    return {
      ok: true,
      url: res.url || input.url,
      titulo: extrairTitulo(html),
      texto,
    };
  } catch (err) {
    console.error('[lerPagina] erro', err);
    return { ok: false, erro: 'Falha ao buscar a página (tempo esgotado ou rede)' };
  }
}

/** Subconjunto útil dos dados públicos de um CNPJ (BrasilAPI / Receita). */
export type SaidaCnpj =
  | {
      ok: true;
      cnpj: string;
      razaoSocial: string;
      nomeFantasia: string | null;
      situacao: string | null;
      atividadePrincipal: string | null;
      municipio: string | null;
      uf: string | null;
      porte: string | null;
      abertura: string | null;
    }
  | { ok: false; erro: string };

/**
 * Consulta os dados públicos de um CNPJ na BrasilAPI (cadastro da Receita
 * Federal — informação pública por lei). Útil para qualificar empresas em
 * pesquisa de mercado e prospecção B2B.
 */
export async function consultarCnpj(input: {
  cnpj: string;
}): Promise<SaidaCnpj> {
  'use step';
  console.log('[consultarCnpj] início', { cnpj: input.cnpj });

  const cnpj = normalizarCnpj(input.cnpj);
  if (!cnpj) {
    return { ok: false, erro: 'CNPJ inválido — informe os 14 dígitos' };
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) {
      return { ok: false, erro: 'CNPJ não encontrado na base pública' };
    }
    if (!res.ok) {
      return { ok: false, erro: `Consulta falhou com status ${res.status}` };
    }

    const d = (await res.json()) as Record<string, unknown>;
    const str = (k: string) =>
      typeof d[k] === 'string' && (d[k] as string).length > 0
        ? (d[k] as string)
        : null;

    console.log('[consultarCnpj] fim', { cnpj });
    return {
      ok: true,
      cnpj,
      razaoSocial: str('razao_social') ?? '',
      nomeFantasia: str('nome_fantasia'),
      situacao: str('descricao_situacao_cadastral'),
      atividadePrincipal: str('cnae_fiscal_descricao'),
      municipio: str('municipio'),
      uf: str('uf'),
      porte: str('porte'),
      abertura: str('data_inicio_atividade'),
    };
  } catch (err) {
    console.error('[consultarCnpj] erro', err);
    return { ok: false, erro: 'Falha na consulta (tempo esgotado ou rede)' };
  }
}
