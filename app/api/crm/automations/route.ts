import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarAutomacao, listarAutomacoes } from '@/src/lib/crm-automation';
import { CrmAutomationInputSchema } from '@/src/domain/crm-automation';

export const dynamic = 'force-dynamic';

/** GET /api/crm/automations?pipelineId=... — automações de um funil. */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const pipelineId = new URL(req.url).searchParams.get('pipelineId');
  if (!pipelineId) return falha(new Error('Informe o pipelineId'));
  const automacoes = await listarAutomacoes(businessId, pipelineId);
  return Response.json({ automacoes });
}

/** POST /api/crm/automations — cria uma automação (gatilho → condições → ações). */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const parsed = CrmAutomationInputSchema.parse(body);
    const automacao = await criarAutomacao(businessId, parsed);
    return Response.json({ automacao }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
