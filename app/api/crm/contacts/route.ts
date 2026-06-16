import { falha, naoAutenticado, negocioAtual } from '@/src/lib/api';
import { criarContato, listarContatos } from '@/src/lib/crm';
import { CrmContactInputSchema } from '@/src/domain/crm';

export const dynamic = 'force-dynamic';

/** GET /api/crm/contacts?query=... — lista/busca contatos do negócio. */
export async function GET(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  const query = new URL(req.url).searchParams.get('query') ?? undefined;
  const contatos = await listarContatos(businessId, { query });
  return Response.json({ contatos });
}

/** POST /api/crm/contacts — cria um contato (valores validados contra os campos). */
export async function POST(req: Request) {
  const businessId = await negocioAtual();
  if (!businessId) return naoAutenticado();

  try {
    const body = await req.json();
    const parsed = CrmContactInputSchema.parse(body);
    const contato = await criarContato(businessId, parsed);
    return Response.json({ contato }, { status: 201 });
  } catch (err) {
    return falha(err);
  }
}
