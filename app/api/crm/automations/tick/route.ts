import { negocioAtual } from '@/src/lib/api';
import {
  processarTemporais,
  processarTemporaisGlobal,
} from '@/src/lib/crm-automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Tick das automações temporais (gatilho `card_parado`).
 *
 * GET  — modo CRON (Vercel Cron). Roda para TODOS os negócios. Protegido pelo
 *        header `Authorization: Bearer <CRON_SECRET>` (a Vercel injeta esse
 *        header quando CRON_SECRET está definido no projeto).
 * POST — modo MANUAL (botão "rodar agora"). Autenticado via Clerk; roda só para
 *        o negócio do usuário. Útil para testar uma automação na hora.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('CRON_SECRET não configurado', { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  const resultado = await processarTemporaisGlobal();
  return Response.json({ ok: true, ...resultado });
}

export async function POST() {
  const businessId = await negocioAtual();
  if (!businessId) return new Response('Não autenticado', { status: 401 });

  const disparos = await processarTemporais(businessId);
  return Response.json({ ok: true, disparos });
}
