import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/src/db';
import {
  crmCards,
  crmContacts,
  crmFields,
  crmPipelines,
  crmStages,
} from '@/src/db/schema';
import {
  type BoardDTO,
  type CardDTO,
  type ContactDTO,
  type CrmFieldEntity,
  type CrmStageTipo,
  type CrmValores,
  type FieldDTO,
  type PipelineDTO,
  type StageDTO,
  chaveDeRotulo,
  corPadraoStage,
  validarValores,
} from '@/src/domain/crm';
import { processarEvento } from '@/src/lib/crm-automation';

/**
 * Repositório do CRM data-driven — CRUD escopado por businessId.
 *
 * Usado tanto pelas rotas REST (UI do kanban) quanto pelas tools do agente CRM.
 * Quem chama é responsável por resolver o negócio do usuário (getOrCreateBusiness).
 * Toda mutação valida que a entidade pertence ao businessId antes de tocar.
 */

/* ------------------------------------------------------------------ *
 * Mapeadores → DTO
 * ------------------------------------------------------------------ */

type PipelineRow = typeof crmPipelines.$inferSelect;
type StageRow = typeof crmStages.$inferSelect;
type FieldRow = typeof crmFields.$inferSelect;
type ContactRow = typeof crmContacts.$inferSelect;
type CardRow = typeof crmCards.$inferSelect;

function toPipeline(r: PipelineRow): PipelineDTO {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    ordem: r.ordem,
    arquivado: r.arquivado,
    criadoEm: r.createdAt.toISOString(),
  };
}

function toStage(r: StageRow): StageDTO {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    nome: r.nome,
    cor: r.cor,
    tipo: r.tipo,
    ordem: r.ordem,
  };
}

function toField(r: FieldRow): FieldDTO {
  return {
    id: r.id,
    entidade: r.entidade,
    pipelineId: r.pipelineId,
    chave: r.chave,
    rotulo: r.rotulo,
    tipo: r.tipo,
    opcoes: r.opcoes,
    obrigatorio: r.obrigatorio,
    ordem: r.ordem,
  };
}

function toContact(r: ContactRow): ContactDTO {
  return {
    id: r.id,
    nome: r.nome,
    valores: r.valores,
    criadoEm: r.createdAt.toISOString(),
    atualizadoEm: r.updatedAt.toISOString(),
  };
}

function toCard(r: CardRow): CardDTO {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    stageId: r.stageId,
    contatoId: r.contatoId,
    titulo: r.titulo,
    valores: r.valores,
    ordem: r.ordem,
    criadoEm: r.createdAt.toISOString(),
    atualizadoEm: r.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Pipelines
 * ------------------------------------------------------------------ */

export async function listarPipelines(businessId: string): Promise<PipelineDTO[]> {
  const rows = await getDb()
    .select()
    .from(crmPipelines)
    .where(eq(crmPipelines.businessId, businessId))
    .orderBy(asc(crmPipelines.ordem), asc(crmPipelines.createdAt));
  return rows.map(toPipeline);
}

export async function lerPipeline(
  businessId: string,
  pipelineId: string,
): Promise<PipelineDTO | null> {
  const rows = await getDb()
    .select()
    .from(crmPipelines)
    .where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.businessId, businessId)))
    .limit(1);
  return rows[0] ? toPipeline(rows[0]) : null;
}

export interface CriarPipelineInput {
  nome: string;
  descricao?: string | null;
  /** Cria os stages iniciais junto (ex.: funil padrão). */
  stages?: { nome: string; tipo?: CrmStageTipo; cor?: string }[];
}

export async function criarPipeline(
  businessId: string,
  input: CriarPipelineInput,
): Promise<{ pipeline: PipelineDTO; stages: StageDTO[] }> {
  const db = getDb();
  const existentes = await listarPipelines(businessId);
  const ordem = existentes.length;

  const [pipeline] = await db
    .insert(crmPipelines)
    .values({
      businessId,
      nome: input.nome,
      descricao: input.descricao ?? null,
      ordem,
    })
    .returning();

  let stages: StageDTO[] = [];
  if (input.stages && input.stages.length > 0) {
    const valores = input.stages.map((s, i) => ({
      businessId,
      pipelineId: pipeline.id,
      nome: s.nome,
      tipo: s.tipo ?? ('aberto' as CrmStageTipo),
      cor: s.cor ?? corPadraoStage(i),
      ordem: i,
    }));
    const rows = await db.insert(crmStages).values(valores).returning();
    stages = rows.map(toStage);
  }

  return { pipeline: toPipeline(pipeline), stages };
}

export async function atualizarPipeline(
  businessId: string,
  pipelineId: string,
  patch: { nome?: string; descricao?: string | null; arquivado?: boolean },
): Promise<PipelineDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.descricao !== undefined) campos.descricao = patch.descricao;
  if (patch.arquivado !== undefined) campos.arquivado = patch.arquivado;

  const [row] = await getDb()
    .update(crmPipelines)
    .set(campos)
    .where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.businessId, businessId)))
    .returning();
  return row ? toPipeline(row) : null;
}

/** Apaga um funil e tudo dentro dele (cards, stages, campos do funil). */
export async function apagarPipeline(
  businessId: string,
  pipelineId: string,
): Promise<void> {
  const db = getDb();
  const dono = and(
    eq(crmPipelines.id, pipelineId),
    eq(crmPipelines.businessId, businessId),
  );
  const existe = await db.select({ id: crmPipelines.id }).from(crmPipelines).where(dono).limit(1);
  if (existe.length === 0) return;

  // Deleção explícita e ordenada (cards antes dos stages por causa da FK).
  await db.delete(crmCards).where(eq(crmCards.pipelineId, pipelineId));
  await db.delete(crmStages).where(eq(crmStages.pipelineId, pipelineId));
  await db.delete(crmFields).where(eq(crmFields.pipelineId, pipelineId));
  await db.delete(crmPipelines).where(dono);
}

/* ------------------------------------------------------------------ *
 * Stages
 * ------------------------------------------------------------------ */

/** Garante que o pipeline pertence ao negócio; lança se não. */
async function exigirPipeline(businessId: string, pipelineId: string): Promise<void> {
  const p = await lerPipeline(businessId, pipelineId);
  if (!p) throw new Error('Funil não encontrado');
}

export async function listarStages(
  businessId: string,
  pipelineId: string,
): Promise<StageDTO[]> {
  const rows = await getDb()
    .select()
    .from(crmStages)
    .where(and(eq(crmStages.businessId, businessId), eq(crmStages.pipelineId, pipelineId)))
    .orderBy(asc(crmStages.ordem), asc(crmStages.createdAt));
  return rows.map(toStage);
}

export async function criarStage(
  businessId: string,
  pipelineId: string,
  input: { nome: string; tipo?: CrmStageTipo; cor?: string },
): Promise<StageDTO> {
  await exigirPipeline(businessId, pipelineId);
  const existentes = await listarStages(businessId, pipelineId);
  const ordem = existentes.length;
  const [row] = await getDb()
    .insert(crmStages)
    .values({
      businessId,
      pipelineId,
      nome: input.nome,
      tipo: input.tipo ?? 'aberto',
      cor: input.cor ?? corPadraoStage(ordem),
      ordem,
    })
    .returning();
  return toStage(row);
}

export async function atualizarStage(
  businessId: string,
  stageId: string,
  patch: { nome?: string; cor?: string; tipo?: CrmStageTipo },
): Promise<StageDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.cor !== undefined) campos.cor = patch.cor;
  if (patch.tipo !== undefined) campos.tipo = patch.tipo;

  const [row] = await getDb()
    .update(crmStages)
    .set(campos)
    .where(and(eq(crmStages.id, stageId), eq(crmStages.businessId, businessId)))
    .returning();
  return row ? toStage(row) : null;
}

/**
 * Apaga um stage. Os cards são reatribuídos a `paraStageId` (ou ao primeiro
 * stage restante do funil). Recusa apagar o último stage do funil.
 */
export async function apagarStage(
  businessId: string,
  stageId: string,
  paraStageId?: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(crmStages)
    .where(and(eq(crmStages.id, stageId), eq(crmStages.businessId, businessId)))
    .limit(1);
  const stage = rows[0];
  if (!stage) return;

  const irmaos = await listarStages(businessId, stage.pipelineId);
  if (irmaos.length <= 1) {
    throw new Error('Um funil precisa ter ao menos um ponto.');
  }

  const destino =
    (paraStageId && irmaos.find((s) => s.id === paraStageId && s.id !== stageId)?.id) ||
    irmaos.find((s) => s.id !== stageId)!.id;

  await db
    .update(crmCards)
    .set({ stageId: destino, updatedAt: new Date() })
    .where(and(eq(crmCards.stageId, stageId), eq(crmCards.businessId, businessId)));

  await db.delete(crmStages).where(eq(crmStages.id, stageId));
}

/** Reordena os stages de um funil conforme a lista de ids fornecida. */
export async function reordenarStages(
  businessId: string,
  pipelineId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getDb();
  const validos = new Set((await listarStages(businessId, pipelineId)).map((s) => s.id));
  let ordem = 0;
  for (const id of orderedIds) {
    if (!validos.has(id)) continue;
    await db
      .update(crmStages)
      .set({ ordem: ordem++, updatedAt: new Date() })
      .where(and(eq(crmStages.id, id), eq(crmStages.businessId, businessId)));
  }
}

/* ------------------------------------------------------------------ *
 * Fields (campos data-driven)
 * ------------------------------------------------------------------ */

/** Lista campos por entidade. Para 'card', inclui globais + os do pipeline. */
export async function listarFields(
  businessId: string,
  opts: { entidade: CrmFieldEntity; pipelineId?: string | null },
): Promise<FieldDTO[]> {
  const db = getDb();
  const cond = [
    eq(crmFields.businessId, businessId),
    eq(crmFields.entidade, opts.entidade),
  ];

  if (opts.entidade === 'card' && opts.pipelineId) {
    // Globais (pipelineId null) OU específicos deste funil.
    const escopo = or(
      isNull(crmFields.pipelineId),
      eq(crmFields.pipelineId, opts.pipelineId),
    );
    if (escopo) cond.push(escopo);
  }

  const rows = await db
    .select()
    .from(crmFields)
    .where(and(...cond))
    .orderBy(asc(crmFields.ordem), asc(crmFields.createdAt));
  return rows.map(toField);
}

export interface CriarFieldInput {
  entidade: CrmFieldEntity;
  rotulo: string;
  tipo: FieldDTO['tipo'];
  chave?: string;
  opcoes?: string[];
  obrigatorio?: boolean;
  pipelineId?: string | null;
}

export async function criarField(
  businessId: string,
  input: CriarFieldInput,
): Promise<FieldDTO> {
  const db = getDb();
  const pipelineId = input.entidade === 'card' ? input.pipelineId ?? null : null;
  if (pipelineId) await exigirPipeline(businessId, pipelineId);

  // Chave estável: a fornecida ou derivada do rótulo; evita colisão por sufixo.
  const existentes = await listarFields(businessId, {
    entidade: input.entidade,
    pipelineId: pipelineId ?? undefined,
  });
  const usadas = new Set(existentes.map((f) => f.chave));
  let chave = input.chave ?? chaveDeRotulo(input.rotulo);
  if (usadas.has(chave)) {
    let i = 2;
    while (usadas.has(`${chave}_${i}`)) i++;
    chave = `${chave}_${i}`;
  }

  const ordem = existentes.length;
  const [row] = await db
    .insert(crmFields)
    .values({
      businessId,
      entidade: input.entidade,
      pipelineId,
      chave,
      rotulo: input.rotulo,
      tipo: input.tipo,
      opcoes: input.opcoes ?? [],
      obrigatorio: input.obrigatorio ?? false,
      ordem,
    })
    .returning();
  return toField(row);
}

export async function atualizarField(
  businessId: string,
  fieldId: string,
  patch: {
    rotulo?: string;
    tipo?: FieldDTO['tipo'];
    opcoes?: string[];
    obrigatorio?: boolean;
  },
): Promise<FieldDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.rotulo !== undefined) campos.rotulo = patch.rotulo;
  if (patch.tipo !== undefined) campos.tipo = patch.tipo;
  if (patch.opcoes !== undefined) campos.opcoes = patch.opcoes;
  if (patch.obrigatorio !== undefined) campos.obrigatorio = patch.obrigatorio;

  const [row] = await getDb()
    .update(crmFields)
    .set(campos)
    .where(and(eq(crmFields.id, fieldId), eq(crmFields.businessId, businessId)))
    .returning();
  return row ? toField(row) : null;
}

export async function apagarField(businessId: string, fieldId: string): Promise<void> {
  await getDb()
    .delete(crmFields)
    .where(and(eq(crmFields.id, fieldId), eq(crmFields.businessId, businessId)));
}

/* ------------------------------------------------------------------ *
 * Contatos
 * ------------------------------------------------------------------ */

export async function listarContatos(
  businessId: string,
  opts: { query?: string; limit?: number } = {},
): Promise<ContactDTO[]> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 50, 200);
  const cond = [eq(crmContacts.businessId, businessId)];
  if (opts.query && opts.query.trim()) {
    cond.push(ilike(crmContacts.nome, `%${opts.query.trim()}%`));
  }
  const rows = await db
    .select()
    .from(crmContacts)
    .where(and(...cond))
    .orderBy(desc(crmContacts.updatedAt))
    .limit(limit);
  return rows.map(toContact);
}

export async function lerContato(
  businessId: string,
  contatoId: string,
): Promise<ContactDTO | null> {
  const rows = await getDb()
    .select()
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contatoId), eq(crmContacts.businessId, businessId)))
    .limit(1);
  return rows[0] ? toContact(rows[0]) : null;
}

export async function criarContato(
  businessId: string,
  input: { nome: string; valores?: CrmValores },
): Promise<ContactDTO> {
  const defs = await listarFields(businessId, { entidade: 'contato' });
  const valores = validarValores(defs, input.valores ?? {});
  const [row] = await getDb()
    .insert(crmContacts)
    .values({ businessId, nome: input.nome, valores })
    .returning();
  return toContact(row);
}

export async function atualizarContato(
  businessId: string,
  contatoId: string,
  patch: { nome?: string; valores?: CrmValores },
): Promise<ContactDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.valores !== undefined) {
    const defs = await listarFields(businessId, { entidade: 'contato' });
    campos.valores = validarValores(defs, patch.valores);
  }
  const [row] = await getDb()
    .update(crmContacts)
    .set(campos)
    .where(and(eq(crmContacts.id, contatoId), eq(crmContacts.businessId, businessId)))
    .returning();
  return row ? toContact(row) : null;
}

export async function apagarContato(businessId: string, contatoId: string): Promise<void> {
  await getDb()
    .delete(crmContacts)
    .where(and(eq(crmContacts.id, contatoId), eq(crmContacts.businessId, businessId)));
}

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

/** Resolve o stage destino de um card: o informado, ou o 1º do funil. */
async function resolverStage(
  businessId: string,
  pipelineId: string,
  stageId?: string,
): Promise<StageDTO> {
  const stages = await listarStages(businessId, pipelineId);
  if (stages.length === 0) throw new Error('O funil ainda não tem pontos.');
  if (stageId) {
    const achado = stages.find((s) => s.id === stageId);
    if (!achado) throw new Error('Ponto do funil inválido para este funil.');
    return achado;
  }
  return stages[0];
}

export async function criarCard(
  businessId: string,
  input: {
    pipelineId: string;
    stageId?: string;
    contatoId?: string | null;
    titulo: string;
    valores?: CrmValores;
  },
): Promise<CardDTO> {
  const db = getDb();
  await exigirPipeline(businessId, input.pipelineId);
  const stage = await resolverStage(businessId, input.pipelineId, input.stageId);

  const defs = await listarFields(businessId, {
    entidade: 'card',
    pipelineId: input.pipelineId,
  });
  const valores = validarValores(defs, input.valores ?? {});

  // Coloca no fim do stage.
  const noStage = await db
    .select({ ordem: crmCards.ordem })
    .from(crmCards)
    .where(and(eq(crmCards.businessId, businessId), eq(crmCards.stageId, stage.id)));
  const ordem = noStage.reduce((m, c) => Math.max(m, c.ordem + 1), 0);

  const [row] = await db
    .insert(crmCards)
    .values({
      businessId,
      pipelineId: input.pipelineId,
      stageId: stage.id,
      contatoId: input.contatoId ?? null,
      titulo: input.titulo,
      valores,
      ordem,
    })
    .returning();
  const card = toCard(row);
  await processarEvento(businessId, { tipo: 'card_criado', card });
  return card;
}

export async function lerCard(
  businessId: string,
  cardId: string,
): Promise<CardDTO | null> {
  const rows = await getDb()
    .select()
    .from(crmCards)
    .where(and(eq(crmCards.id, cardId), eq(crmCards.businessId, businessId)))
    .limit(1);
  return rows[0] ? toCard(rows[0]) : null;
}

export async function atualizarCard(
  businessId: string,
  cardId: string,
  patch: { titulo?: string; contatoId?: string | null; valores?: CrmValores },
): Promise<CardDTO | null> {
  const atual = await lerCard(businessId, cardId);
  if (!atual) return null;

  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.titulo !== undefined) campos.titulo = patch.titulo;
  if (patch.contatoId !== undefined) campos.contatoId = patch.contatoId;
  if (patch.valores !== undefined) {
    const defs = await listarFields(businessId, {
      entidade: 'card',
      pipelineId: atual.pipelineId,
    });
    // merge: preserva valores existentes não enviados no patch.
    campos.valores = validarValores(defs, { ...atual.valores, ...patch.valores });
  }

  const [row] = await getDb()
    .update(crmCards)
    .set(campos)
    .where(and(eq(crmCards.id, cardId), eq(crmCards.businessId, businessId)))
    .returning();
  const atualizado = row ? toCard(row) : null;
  if (atualizado) {
    await processarEvento(businessId, { tipo: 'card_atualizado', card: atualizado });
  }
  return atualizado;
}

/**
 * Move um card para um stage e, opcionalmente, reordena a coluna destino.
 * Quando `orderedIds` vem (drag-drop fino), regrava a ordem (0..n) dos cards
 * do stage destino. Sem ela (ex.: agente), o card vai para o fim.
 */
export async function moverCard(
  businessId: string,
  cardId: string,
  stageId: string,
  orderedIds?: string[],
): Promise<CardDTO | null> {
  const db = getDb();
  const card = await lerCard(businessId, cardId);
  if (!card) return null;
  const stageAnteriorId = card.stageId;
  const stage = await resolverStage(businessId, card.pipelineId, stageId);
  const mudouStage = stageAnteriorId !== stage.id;

  await db
    .update(crmCards)
    .set({
      stageId: stage.id,
      updatedAt: new Date(),
      // Reinicia o cronômetro "parado no ponto" só quando muda de ponto.
      ...(mudouStage ? { stageChangedAt: new Date() } : {}),
    })
    .where(and(eq(crmCards.id, cardId), eq(crmCards.businessId, businessId)));

  if (orderedIds && orderedIds.length > 0) {
    const validos = await db
      .select({ id: crmCards.id })
      .from(crmCards)
      .where(and(eq(crmCards.businessId, businessId), eq(crmCards.stageId, stage.id)));
    const set = new Set(validos.map((c) => c.id));
    let ordem = 0;
    for (const id of orderedIds) {
      if (!set.has(id)) continue;
      await db
        .update(crmCards)
        .set({ ordem: ordem++, updatedAt: new Date() })
        .where(and(eq(crmCards.id, id), eq(crmCards.businessId, businessId)));
    }
  } else {
    const noStage = await db
      .select({ ordem: crmCards.ordem })
      .from(crmCards)
      .where(
        and(
          eq(crmCards.businessId, businessId),
          eq(crmCards.stageId, stage.id),
          // exclui o próprio card do cálculo de fim
        ),
      );
    const fim = noStage.reduce((m, c) => Math.max(m, c.ordem + 1), 0);
    await db
      .update(crmCards)
      .set({ ordem: fim, updatedAt: new Date() })
      .where(and(eq(crmCards.id, cardId), eq(crmCards.businessId, businessId)));
  }

  const atualizado = await lerCard(businessId, cardId);
  // Dispara o gatilho só quando o card de fato entra em outro ponto.
  if (atualizado && mudouStage) {
    await processarEvento(businessId, {
      tipo: 'card_movido',
      card: atualizado,
      stageAnteriorId,
    });
  }
  return atualizado;
}

export async function apagarCard(businessId: string, cardId: string): Promise<void> {
  await getDb()
    .delete(crmCards)
    .where(and(eq(crmCards.id, cardId), eq(crmCards.businessId, businessId)));
}

/* ------------------------------------------------------------------ *
 * Board (kanban completo de um funil)
 * ------------------------------------------------------------------ */

export async function getBoard(
  businessId: string,
  pipelineId: string,
): Promise<BoardDTO | null> {
  const pipeline = await lerPipeline(businessId, pipelineId);
  if (!pipeline) return null;

  const [stages, fields, cardRows] = await Promise.all([
    listarStages(businessId, pipelineId),
    listarFields(businessId, { entidade: 'card', pipelineId }),
    getDb()
      .select()
      .from(crmCards)
      .where(and(eq(crmCards.businessId, businessId), eq(crmCards.pipelineId, pipelineId)))
      .orderBy(asc(crmCards.ordem), asc(crmCards.createdAt)),
  ]);

  return { pipeline, stages, fields, cards: cardRows.map(toCard) };
}

/* ------------------------------------------------------------------ *
 * Seed inicial
 * ------------------------------------------------------------------ */

/**
 * Garante que o negócio tenha pelo menos um funil para começar. Cria um funil
 * de "Vendas" com pontos e campos comuns — tudo editável depois pelo dono.
 *
 * Idempotente E à prova de corrida: um advisory lock por negócio serializa a
 * semeadura, então acessos simultâneos (ex.: React StrictMode em dev dispara
 * dois GETs) não criam funis duplicados.
 */
export async function garantirCrmInicial(businessId: string): Promise<PipelineDTO> {
  const db = getDb();
  return db.transaction(async (tx) => {
    // Serializa por negócio: só um seeder roda por vez para este businessId.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${businessId}))`);

    const existentes = await tx
      .select()
      .from(crmPipelines)
      .where(eq(crmPipelines.businessId, businessId))
      .orderBy(asc(crmPipelines.ordem), asc(crmPipelines.createdAt))
      .limit(1);
    if (existentes[0]) return toPipeline(existentes[0]);

    const [pipeline] = await tx
      .insert(crmPipelines)
      .values({
        businessId,
        nome: 'Funil de Vendas',
        descricao: 'Seu funil inicial — ajuste os pontos e campos como precisar.',
        ordem: 0,
      })
      .returning();

    const stagesSeed: { nome: string; tipo: CrmStageTipo }[] = [
      { nome: 'Lead', tipo: 'aberto' },
      { nome: 'Contato feito', tipo: 'aberto' },
      { nome: 'Proposta', tipo: 'aberto' },
      { nome: 'Negociação', tipo: 'aberto' },
      { nome: 'Ganho', tipo: 'ganho' },
      { nome: 'Perdido', tipo: 'perdido' },
    ];
    await tx.insert(crmStages).values(
      stagesSeed.map((s, i) => ({
        businessId,
        pipelineId: pipeline.id,
        nome: s.nome,
        tipo: s.tipo,
        cor: corPadraoStage(i),
        ordem: i,
      })),
    );

    // Campos iniciais (data-driven, editáveis). Chaves estáveis explícitas.
    await tx.insert(crmFields).values([
      {
        businessId,
        entidade: 'card' as CrmFieldEntity,
        pipelineId: pipeline.id,
        chave: 'valor_estimado',
        rotulo: 'Valor estimado',
        tipo: 'currency',
        ordem: 0,
      },
      {
        businessId,
        entidade: 'card' as CrmFieldEntity,
        pipelineId: pipeline.id,
        chave: 'origem',
        rotulo: 'Origem',
        tipo: 'select',
        opcoes: ['Indicação', 'Instagram', 'WhatsApp', 'Site', 'Feira/Evento', 'Outro'],
        ordem: 1,
      },
      {
        businessId,
        entidade: 'card' as CrmFieldEntity,
        pipelineId: pipeline.id,
        chave: 'proximo_passo',
        rotulo: 'Próximo passo',
        tipo: 'text',
        ordem: 2,
      },
      {
        businessId,
        entidade: 'contato' as CrmFieldEntity,
        pipelineId: null,
        chave: 'empresa',
        rotulo: 'Empresa',
        tipo: 'text',
        ordem: 0,
      },
      {
        businessId,
        entidade: 'contato' as CrmFieldEntity,
        pipelineId: null,
        chave: 'whatsapp',
        rotulo: 'WhatsApp',
        tipo: 'phone',
        ordem: 1,
      },
      {
        businessId,
        entidade: 'contato' as CrmFieldEntity,
        pipelineId: null,
        chave: 'email',
        rotulo: 'E-mail',
        tipo: 'email',
        ordem: 2,
      },
    ]);

    return toPipeline(pipeline);
  });
}

/** Resumo textual do CRM para dar contexto ao agente (sem despejar tudo). */
export async function resumoCrm(businessId: string): Promise<string> {
  const pipelines = await listarPipelines(businessId);
  if (pipelines.length === 0) return 'Nenhum funil criado ainda.';

  const partes: string[] = [];
  for (const p of pipelines) {
    const [stages, fields] = await Promise.all([
      listarStages(businessId, p.id),
      listarFields(businessId, { entidade: 'card', pipelineId: p.id }),
    ]);
    const total = await getDb()
      .select({ id: crmCards.id })
      .from(crmCards)
      .where(and(eq(crmCards.businessId, businessId), eq(crmCards.pipelineId, p.id)));
    partes.push(
      `Funil "${p.nome}" (id ${p.id}): ${stages.length} pontos [${stages
        .map((s) => s.nome)
        .join(' → ')}], ${fields.length} campos de card, ${total.length} cards.`,
    );
  }
  return partes.join('\n');
}
