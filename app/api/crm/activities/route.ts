import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarAtividade, listarAtividades } from '@/src/lib/crm-activity';
import { CrmActivityInputSchema } from '@/src/domain/crm-activity';

export const dynamic = 'force-dynamic';

/** GET /api/crm/activities?de&ate&status&cardId — lista atividades da agenda. */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const atividades = await listarAtividades(businessId, {
    de: url.searchParams.get('de') ?? undefined,
    ate: url.searchParams.get('ate') ?? undefined,
    cardId: url.searchParams.get('cardId') ?? undefined,
    status:
      status === 'pendente' || status === 'concluida' || status === 'todas'
        ? status
        : undefined,
  });
  return Response.json({ atividades });
}

/** POST /api/crm/activities — cria uma atividade. */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const parsed = CrmActivityInputSchema.parse(body);
    const atividade = await criarAtividade(businessId, {
      titulo: parsed.titulo,
      tipo: parsed.tipo,
      descricao: parsed.descricao ?? null,
      inicioEm: parsed.inicioEm,
      fimEm: parsed.fimEm ?? null,
      diaInteiro: parsed.diaInteiro,
      cardId: parsed.cardId ?? null,
      contatoId: parsed.contatoId ?? null,
    });
    return Response.json({ atividade }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
