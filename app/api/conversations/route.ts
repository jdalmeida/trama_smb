import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { criarConversa, listarConversas } from '@/src/lib/conversations';

export const dynamic = 'force-dynamic';

/** GET /api/conversations — lista as conversas do negócio (mais ativas primeiro). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  const conversas = await listarConversas(business.id);
  return Response.json({ conversas });
}

/** POST /api/conversations — cria uma conversa nova (vazia). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const business = await getOrCreateBusiness(userId);
  const body = (await req.json().catch(() => ({}))) as { titulo?: string };
  const conversa = await criarConversa(business.id, body.titulo);
  return Response.json({ conversa }, { status: 201 });
}
