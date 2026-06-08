import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getOrCreateBusiness, getProfile } from '@/src/lib/business';
import { iniciarPlano } from '@/src/lib/orchestrate';
import { PERSONA_IDS } from '@/src/domain/persona';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BodySchema = z.object({
  tarefas: z
    .array(
      z.object({
        personaId: z.enum(PERSONA_IDS),
        tarefa: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * POST /api/orchestrate
 *
 * Dispara o workflow orquestrador para um plano inteiro (várias personas).
 * Pré-cria os entregáveis, inicia o run durável e devolve os IDs.
 * A UI descobre os runs filhos via GET /api/runs.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Não autenticado', { status: 401 });
  }

  const business = await getOrCreateBusiness(userId);
  const prof = await getProfile(business.id);
  if (!prof) {
    return Response.json(
      { ok: false, erro: 'Perfil do Negócio ainda não foi preenchido.' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { ok: false, erro: 'Corpo inválido', detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const plano = await iniciarPlano(business.id, prof.profile, parsed.data.tarefas);
  return Response.json({ ok: true, ...plano });
}
