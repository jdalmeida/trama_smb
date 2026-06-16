import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarField, listarFields } from '@/src/lib/crm';
import {
  CRM_FIELD_ENTITIES,
  CRM_FIELD_TYPES,
  type CrmFieldEntity,
  type CrmFieldType,
} from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/fields?entidade=card|contato&pipelineId=... — lista as
 * definições de campo. Para 'card', inclui globais + os do funil informado.
 */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const url = new URL(req.url);
  const entidade = url.searchParams.get('entidade') as CrmFieldEntity | null;
  if (!entidade || !CRM_FIELD_ENTITIES.includes(entidade)) {
    return falha(new Error('Informe entidade=card|contato'));
  }
  const pipelineId = url.searchParams.get('pipelineId') ?? undefined;
  const fields = await listarFields(businessId, { entidade, pipelineId });
  return Response.json({ fields });
}

/** POST /api/crm/fields — cria um campo customizável. */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = (await req.json()) as {
      entidade?: string;
      rotulo?: string;
      tipo?: string;
      chave?: string;
      opcoes?: string[];
      obrigatorio?: boolean;
      pipelineId?: string | null;
    };
    if (!body.entidade || !CRM_FIELD_ENTITIES.includes(body.entidade as CrmFieldEntity)) {
      return falha(new Error('entidade inválida'));
    }
    if (!body.tipo || !CRM_FIELD_TYPES.includes(body.tipo as CrmFieldType)) {
      return falha(new Error('tipo de campo inválido'));
    }
    if (!body.rotulo || !body.rotulo.trim()) {
      return falha(new Error('Informe o rótulo do campo'));
    }

    const field = await criarField(businessId, {
      entidade: body.entidade as CrmFieldEntity,
      rotulo: body.rotulo.trim(),
      tipo: body.tipo as CrmFieldType,
      chave: body.chave,
      opcoes: Array.isArray(body.opcoes) ? body.opcoes : [],
      obrigatorio: body.obrigatorio === true,
      pipelineId: body.pipelineId ?? null,
    });
    return Response.json({ field }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
