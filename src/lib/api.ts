import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';

/**
 * Helpers compartilhados das rotas REST do CRM.
 *
 * Mantêm o mesmo contrato de tenancy do resto do app (Clerk → businessId),
 * só que sem repetir o boilerplate de auth em cada handler.
 */

/** Resolve o businessId do usuário autenticado, ou null se não logado. */
export async function negocioAtual(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const business = await getOrCreateBusiness(userId);
  return business.id;
}

/** Response 401 padrão. */
export function naoAutenticado(): Response {
  return new Response('Não autenticado', { status: 401 });
}

/**
 * Converte um erro (geralmente de validação lançado pela lib do CRM) numa
 * Response 400 com mensagem amigável. Erros inesperados viram 500.
 */
export function falha(err: unknown, status = 400): Response {
  const msg = err instanceof Error ? err.message : 'Requisição inválida';
  return Response.json({ ok: false, erro: msg }, { status });
}
