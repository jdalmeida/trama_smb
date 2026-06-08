import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness, getProfile, upsertProfile } from '@/src/lib/business';
import { BusinessProfileSchema } from '@/src/domain/business-profile';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile
 *
 * Devolve o Perfil do Negócio (jsonb) do usuário autenticado e se ele já foi
 * verificado pelo humano.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);
  const row = await getProfile(business.id);

  return Response.json({
    profile: row?.profile ?? null,
    verified: row?.verified ?? false,
  });
}

/**
 * POST /api/profile
 *
 * Cria ou atualiza o Perfil do Negócio. Valida o corpo com o schema do domínio
 * antes de persistir. Por padrão marca como verificado (ação humana).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);

  const body = await req.json();

  const parsed = BusinessProfileSchema.safeParse(body?.profile);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Perfil inválido', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const verified = typeof body?.verified === 'boolean' ? body.verified : true;
  await upsertProfile(business.id, parsed.data, verified);

  return Response.json({ ok: true });
}
