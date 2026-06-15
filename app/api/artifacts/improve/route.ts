import { auth } from '@clerk/nextjs/server';
import { streamText } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { getOrCreateBusiness, getProfile } from '@/src/lib/business';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/artifacts/improve
 *
 * Reescreve/melhora o conteúdo de um artefato e devolve a nova versão como
 * stream de texto puro (a UI mostra antes/depois e o usuário aceita ou
 * descarta antes de salvar). Não persiste nada — só gera a sugestão.
 * Corpo: { titulo, categoria, conteudo, instrucao? }.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  const body = (await req.json()) as {
    titulo?: string;
    categoria?: string;
    conteudo?: string;
    instrucao?: string;
  };

  const conteudo = (body.conteudo ?? '').trim();
  if (!conteudo) return new Response('Conteúdo vazio', { status: 400 });

  // Dá ao modelo um pouco de contexto do negócio, se já houver perfil.
  const prof = await getProfile(business.id);
  const contextoNegocio = prof
    ? `Contexto do negócio: ${prof.profile.nomeNegocio} — ${prof.profile.setor}. ` +
      `Produto/serviço: ${prof.profile.produtoServico}. Público: ${prof.profile.publicoAlvo}.`
    : 'Sem perfil do negócio cadastrado ainda.';

  const instrucao = (body.instrucao ?? '').trim();

  const result = streamText({
    model: modelFor('reasoning'),
    system:
      'Você é um editor de conteúdo de negócios brasileiro. Melhore o artefato ' +
      'a seguir mantendo o idioma português do Brasil e o formato Markdown. ' +
      'Deixe o texto mais claro, organizado e acionável, sem inventar fatos que ' +
      'não estejam no original. Preserve dados, números e links. Responda APENAS ' +
      'com o conteúdo melhorado em Markdown, sem preâmbulo nem comentários.',
    prompt:
      `${contextoNegocio}\n\n` +
      `Título do artefato: ${body.titulo ?? '(sem título)'}\n` +
      `Categoria: ${body.categoria ?? 'nota'}\n` +
      (instrucao ? `Instrução específica do usuário: ${instrucao}\n` : '') +
      `\nConteúdo atual:\n"""\n${conteudo}\n"""\n\n` +
      'Reescreva o conteúdo acima melhorando-o:',
  });

  return result.toTextStreamResponse();
}
