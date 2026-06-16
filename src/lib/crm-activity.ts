import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { crmActivities, crmCards } from '@/src/db/schema';
import type { ActivityDTO, CrmActivityTipo } from '@/src/domain/crm-activity';

/**
 * Repositório da agenda do CRM — CRUD escopado por businessId.
 *
 * Usado pelas rotas REST (UI da agenda) e pelo motor de automações (ação
 * `criar_atividade`). Listagens trazem o título do card vinculado (left join)
 * para a UI não precisar resolver à parte.
 */

type ActivityRow = typeof crmActivities.$inferSelect;

function toActivity(r: ActivityRow, cardTitulo: string | null): ActivityDTO {
  return {
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    descricao: r.descricao,
    inicioEm: r.inicioEm.toISOString(),
    fimEm: r.fimEm ? r.fimEm.toISOString() : null,
    diaInteiro: r.diaInteiro,
    concluida: r.concluida,
    concluidaEm: r.concluidaEm ? r.concluidaEm.toISOString() : null,
    cardId: r.cardId,
    cardTitulo,
    contatoId: r.contatoId,
    criadoEm: r.createdAt.toISOString(),
  };
}

export interface ListarAtividadesOpts {
  /** Intervalo (ISO) sobre inicioEm. */
  de?: string;
  ate?: string;
  status?: 'pendente' | 'concluida' | 'todas';
  cardId?: string;
  limit?: number;
}

export async function listarAtividades(
  businessId: string,
  opts: ListarAtividadesOpts = {},
): Promise<ActivityDTO[]> {
  const db = getDb();
  const cond = [eq(crmActivities.businessId, businessId)];
  if (opts.de) cond.push(gte(crmActivities.inicioEm, new Date(opts.de)));
  if (opts.ate) cond.push(lte(crmActivities.inicioEm, new Date(opts.ate)));
  if (opts.cardId) cond.push(eq(crmActivities.cardId, opts.cardId));
  if (opts.status === 'pendente') cond.push(eq(crmActivities.concluida, false));
  if (opts.status === 'concluida') cond.push(eq(crmActivities.concluida, true));

  const rows = await db
    .select({ a: crmActivities, cardTitulo: crmCards.titulo })
    .from(crmActivities)
    .leftJoin(crmCards, eq(crmActivities.cardId, crmCards.id))
    .where(and(...cond))
    .orderBy(asc(crmActivities.inicioEm))
    .limit(Math.min(opts.limit ?? 300, 500));

  return rows.map((r) => toActivity(r.a, r.cardTitulo));
}

export interface CriarAtividadeInput {
  titulo: string;
  tipo: CrmActivityTipo;
  descricao?: string | null;
  inicioEm: string;
  fimEm?: string | null;
  diaInteiro?: boolean;
  cardId?: string | null;
  contatoId?: string | null;
}

/** Garante que um id (card/contato) pertence ao negócio; senão devolve null. */
async function vincularValido(
  businessId: string,
  tabela: typeof crmCards,
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  const rows = await getDb()
    .select({ id: tabela.id })
    .from(tabela)
    .where(and(eq(tabela.id, id), eq(tabela.businessId, businessId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function criarAtividade(
  businessId: string,
  input: CriarAtividadeInput,
): Promise<ActivityDTO> {
  const db = getDb();
  const cardId = await vincularValido(businessId, crmCards, input.cardId);

  const [row] = await db
    .insert(crmActivities)
    .values({
      businessId,
      cardId,
      contatoId: input.contatoId ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      inicioEm: new Date(input.inicioEm),
      fimEm: input.fimEm ? new Date(input.fimEm) : null,
      diaInteiro: input.diaInteiro ?? false,
    })
    .returning();

  // Resolve o título do card vinculado para a resposta.
  let cardTitulo: string | null = null;
  if (row.cardId) {
    const c = await db
      .select({ titulo: crmCards.titulo })
      .from(crmCards)
      .where(eq(crmCards.id, row.cardId))
      .limit(1);
    cardTitulo = c[0]?.titulo ?? null;
  }
  return toActivity(row, cardTitulo);
}

export async function atualizarAtividade(
  businessId: string,
  activityId: string,
  patch: Partial<CriarAtividadeInput>,
): Promise<ActivityDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.titulo !== undefined) campos.titulo = patch.titulo;
  if (patch.tipo !== undefined) campos.tipo = patch.tipo;
  if (patch.descricao !== undefined) campos.descricao = patch.descricao;
  if (patch.inicioEm !== undefined) campos.inicioEm = new Date(patch.inicioEm);
  if (patch.fimEm !== undefined) campos.fimEm = patch.fimEm ? new Date(patch.fimEm) : null;
  if (patch.diaInteiro !== undefined) campos.diaInteiro = patch.diaInteiro;
  if (patch.cardId !== undefined)
    campos.cardId = await vincularValido(businessId, crmCards, patch.cardId);
  if (patch.contatoId !== undefined) campos.contatoId = patch.contatoId;

  const [row] = await getDb()
    .update(crmActivities)
    .set(campos)
    .where(and(eq(crmActivities.id, activityId), eq(crmActivities.businessId, businessId)))
    .returning();
  if (!row) return null;

  let cardTitulo: string | null = null;
  if (row.cardId) {
    const c = await getDb()
      .select({ titulo: crmCards.titulo })
      .from(crmCards)
      .where(eq(crmCards.id, row.cardId))
      .limit(1);
    cardTitulo = c[0]?.titulo ?? null;
  }
  return toActivity(row, cardTitulo);
}

export async function concluirAtividade(
  businessId: string,
  activityId: string,
  concluida: boolean,
): Promise<ActivityDTO | null> {
  const [row] = await getDb()
    .update(crmActivities)
    .set({
      concluida,
      concluidaEm: concluida ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(crmActivities.id, activityId), eq(crmActivities.businessId, businessId)))
    .returning();
  return row ? toActivity(row, null) : null;
}

export async function apagarAtividade(
  businessId: string,
  activityId: string,
): Promise<void> {
  await getDb()
    .delete(crmActivities)
    .where(and(eq(crmActivities.id, activityId), eq(crmActivities.businessId, businessId)));
}

/** Conta atividades pendentes (para badges). */
export async function contarPendentes(businessId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: crmActivities.id })
    .from(crmActivities)
    .where(
      and(eq(crmActivities.businessId, businessId), eq(crmActivities.concluida, false)),
    );
  return rows.length;
}
