import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarCard } from '@/src/lib/crm';
import { CrmCardInputSchema } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

/** POST /api/crm/cards — cria um card num funil (valores validados). */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const parsed = CrmCardInputSchema.parse(body);
    const card = await criarCard(businessId, {
      pipelineId: parsed.pipelineId,
      stageId: parsed.stageId,
      contatoId: parsed.contatoId ?? null,
      titulo: parsed.titulo,
      valores: parsed.valores,
    });
    return Response.json({ card }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
