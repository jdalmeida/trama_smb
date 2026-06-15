import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness } from '@/src/lib/business';
import { listarMensagens } from '@/src/lib/chat-history';
import {
  apagarConversa,
  getConversa,
  renomearConversa,
} from '@/src/lib/conversations';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/conversations/[id] — mensagens da conversa, para hidratar o useChat. */
export async function GET(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const conversa = await getConversa(business.id, id);
  if (!conversa) return new Response('Conversa não encontrada', { status: 404 });

  const mensagens = await listarMensagens(business.id, id);
  return Response.json({ conversa, mensagens });
}

/** PATCH /api/conversations/[id] — renomeia a conversa. */
export async function PATCH(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  const body = (await req.json()) as { titulo?: string };
  const titulo = (body.titulo ?? '').trim();
  if (!titulo) return new Response('Título obrigatório', { status: 400 });

  const conversa = await renomearConversa(business.id, id, titulo);
  if (!conversa) return new Response('Conversa não encontrada', { status: 404 });
  return Response.json({ conversa });
}

/** DELETE /api/conversations/[id] — apaga a conversa e suas mensagens (cascade). */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });

  const { id } = await params;
  const business = await getOrCreateBusiness(userId);
  await apagarConversa(business.id, id);
  return Response.json({ ok: true });
}
