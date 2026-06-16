import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import {
  criarPipeline,
  garantirCrmInicial,
  listarPipelines,
} from '@/src/lib/crm';
import { CrmPipelineInputSchema } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/pipelines — lista os funis do negócio. Na primeira vez, semeia
 * um funil de Vendas padrão (idempotente) para o dono começar com algo.
 */
export async function GET() {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  await garantirCrmInicial(businessId);
  const pipelines = await listarPipelines(businessId);
  return Response.json({ pipelines });
}

/** POST /api/crm/pipelines — cria um funil (com stages padrão se não informados). */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const parsed = CrmPipelineInputSchema.parse(body);

    // Stages: usa os informados (validados pelo schema) ou um padrão simples.
    const stagesPadrao = [
      { nome: 'A fazer', tipo: 'aberto' as const },
      { nome: 'Em andamento', tipo: 'aberto' as const },
      { nome: 'Concluído', tipo: 'ganho' as const },
    ];
    const stagesInput = Array.isArray(body?.stages)
      ? body.stages
          .filter((s: unknown): s is { nome: string } =>
            Boolean(s && typeof (s as { nome?: unknown }).nome === 'string'),
          )
          .map((s: { nome: string; tipo?: 'aberto' | 'ganho' | 'perdido' }) => ({
            nome: s.nome,
            tipo: s.tipo ?? ('aberto' as const),
          }))
      : [];

    const { pipeline, stages } = await criarPipeline(businessId, {
      nome: parsed.nome,
      descricao: parsed.descricao ?? null,
      stages: stagesInput.length > 0 ? stagesInput : stagesPadrao,
    });
    return Response.json({ pipeline, stages }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
