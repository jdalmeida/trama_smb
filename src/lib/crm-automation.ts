import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { crmAutomationRuns, crmAutomations, crmCards, crmStages } from '@/src/db/schema';
import { criarArtefato } from '@/src/lib/artifacts';
import { criarAtividade } from '@/src/lib/crm-activity';
import type { CardDTO } from '@/src/domain/crm';
import {
  CAMPO_TITULO,
  type AutomationDTO,
  type AutomationRunDTO,
  type CrmAcao,
  type CrmAutomationInput,
  type CrmAutomationRunStatus,
  type CrmCondicao,
  type CrmOperador,
  type CrmTrigger,
} from '@/src/domain/crm-automation';

/**
 * Motor de automações do CRM + CRUD. Tudo escopado por businessId.
 *
 * O motor (`processarEvento`) é chamado pelas libs do CRM logo após criar,
 * mover ou editar um card. Ele acha as automações daquele funil/gatilho, avalia
 * as condições e executa as ações. As ações usam updates DIRETOS no banco (não
 * passam pelas libs do CRM) — então NÃO re-disparam automações: sem laços.
 */

/* ------------------------------------------------------------------ *
 * Mapeadores
 * ------------------------------------------------------------------ */

type AutomationRow = typeof crmAutomations.$inferSelect;
type RunRow = typeof crmAutomationRuns.$inferSelect;

function toAutomation(r: AutomationRow): AutomationDTO {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    nome: r.nome,
    trigger: r.trigger,
    triggerStageId: r.triggerStageId,
    triggerDias: r.triggerDias,
    condicoes: r.condicoes,
    acoes: r.acoes,
    enabled: r.enabled,
    ordem: r.ordem,
    criadoEm: r.createdAt.toISOString(),
  };
}

/** Mapeia uma linha de crm_cards para CardDTO (sem depender de lib/crm). */
function cardRowToDTO(r: typeof crmCards.$inferSelect): CardDTO {
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

function toRun(r: RunRow): AutomationRunDTO {
  return {
    id: r.id,
    automationId: r.automationId,
    cardId: r.cardId,
    status: r.status,
    mensagem: r.mensagem,
    criadoEm: r.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * CRUD
 * ------------------------------------------------------------------ */

export async function listarAutomacoes(
  businessId: string,
  pipelineId: string,
): Promise<AutomationDTO[]> {
  const rows = await getDb()
    .select()
    .from(crmAutomations)
    .where(
      and(
        eq(crmAutomations.businessId, businessId),
        eq(crmAutomations.pipelineId, pipelineId),
      ),
    )
    .orderBy(asc(crmAutomations.ordem), asc(crmAutomations.createdAt));
  return rows.map(toAutomation);
}

export async function criarAutomacao(
  businessId: string,
  input: CrmAutomationInput,
): Promise<AutomationDTO> {
  const db = getDb();
  const existentes = await listarAutomacoes(businessId, input.pipelineId);
  const [row] = await db
    .insert(crmAutomations)
    .values({
      businessId,
      pipelineId: input.pipelineId,
      nome: input.nome,
      trigger: input.trigger,
      triggerStageId: input.trigger === 'card_movido' ? input.triggerStageId ?? null : null,
      triggerDias: input.trigger === 'card_parado' ? input.triggerDias ?? null : null,
      condicoes: input.condicoes,
      acoes: input.acoes,
      enabled: input.enabled,
      ordem: existentes.length,
    })
    .returning();
  return toAutomation(row);
}

export async function atualizarAutomacao(
  businessId: string,
  automationId: string,
  patch: Partial<
    Pick<
      CrmAutomationInput,
      'nome' | 'enabled' | 'condicoes' | 'acoes' | 'triggerStageId' | 'triggerDias'
    >
  >,
): Promise<AutomationDTO | null> {
  const campos: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.nome !== undefined) campos.nome = patch.nome;
  if (patch.enabled !== undefined) campos.enabled = patch.enabled;
  if (patch.condicoes !== undefined) campos.condicoes = patch.condicoes;
  if (patch.acoes !== undefined) campos.acoes = patch.acoes;
  if (patch.triggerStageId !== undefined) campos.triggerStageId = patch.triggerStageId;
  if (patch.triggerDias !== undefined) campos.triggerDias = patch.triggerDias;

  const [row] = await getDb()
    .update(crmAutomations)
    .set(campos)
    .where(
      and(eq(crmAutomations.id, automationId), eq(crmAutomations.businessId, businessId)),
    )
    .returning();
  return row ? toAutomation(row) : null;
}

export async function apagarAutomacao(
  businessId: string,
  automationId: string,
): Promise<void> {
  await getDb()
    .delete(crmAutomations)
    .where(
      and(eq(crmAutomations.id, automationId), eq(crmAutomations.businessId, businessId)),
    );
}

export async function listarRuns(
  businessId: string,
  opts: { pipelineId?: string; limit?: number } = {},
): Promise<AutomationRunDTO[]> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 30, 100);

  // Sem filtro de pipeline: histórico geral do negócio.
  if (!opts.pipelineId) {
    const rows = await db
      .select()
      .from(crmAutomationRuns)
      .where(eq(crmAutomationRuns.businessId, businessId))
      .orderBy(desc(crmAutomationRuns.createdAt))
      .limit(limit);
    return rows.map(toRun);
  }

  // Com pipeline: join nas automações daquele funil.
  const rows = await db
    .select({ run: crmAutomationRuns })
    .from(crmAutomationRuns)
    .innerJoin(crmAutomations, eq(crmAutomationRuns.automationId, crmAutomations.id))
    .where(
      and(
        eq(crmAutomationRuns.businessId, businessId),
        eq(crmAutomations.pipelineId, opts.pipelineId),
      ),
    )
    .orderBy(desc(crmAutomationRuns.createdAt))
    .limit(limit);
  return rows.map((r) => toRun(r.run));
}

/* ------------------------------------------------------------------ *
 * Motor
 * ------------------------------------------------------------------ */

export type CrmEvento =
  | { tipo: 'card_criado'; card: CardDTO }
  | { tipo: 'card_movido'; card: CardDTO; stageAnteriorId: string }
  | { tipo: 'card_atualizado'; card: CardDTO };

/**
 * Processa um evento do CRM contra as automações do funil. Resiliente: erros de
 * uma automação não derrubam a operação que originou o evento (são logados).
 * Chamado em "fire-and-await" pelas libs do CRM.
 */
export async function processarEvento(
  businessId: string,
  evento: CrmEvento,
): Promise<void> {
  try {
    const card = evento.card;
    const automacoes = await listarAutomacoes(businessId, card.pipelineId);

    const aplicaveis = automacoes.filter((a) => {
      if (!a.enabled) return false;
      if (a.trigger !== evento.tipo) return false;
      // card_movido com ponto específico: só dispara ao ENTRAR nesse ponto.
      if (
        evento.tipo === 'card_movido' &&
        a.triggerStageId &&
        a.triggerStageId !== card.stageId
      ) {
        return false;
      }
      return true;
    });

    if (aplicaveis.length === 0) return;

    for (const automacao of aplicaveis) {
      if (!avaliarCondicoes(card, automacao.condicoes)) continue;
      await executarAcoes(businessId, automacao.id, automacao.nome, card, automacao.acoes);
    }
  } catch (err) {
    // Nunca propaga: o evento é um efeito colateral da operação principal.
    console.error('[crm-automation] falha ao processar evento', err);
  }
}

/** Avalia as condições (AND). Sem condições → sempre passa. */
export function avaliarCondicoes(card: CardDTO, condicoes: CrmCondicao[]): boolean {
  return condicoes.every((c) => avaliarCondicao(card, c));
}

function valorDoCampo(card: CardDTO, campo: string): unknown {
  if (campo === CAMPO_TITULO) return card.titulo;
  return card.valores[campo];
}

function avaliarCondicao(card: CardDTO, cond: CrmCondicao): boolean {
  const bruto = valorDoCampo(card, cond.campo);
  const vazio =
    bruto === undefined ||
    bruto === null ||
    bruto === '' ||
    (Array.isArray(bruto) && bruto.length === 0);

  const op: CrmOperador = cond.operador;
  if (op === 'vazio') return vazio;
  if (op === 'preenchido') return !vazio;

  const alvo = cond.valor ?? '';
  const atualStr = Array.isArray(bruto) ? bruto.join(', ') : String(bruto ?? '');

  switch (op) {
    case 'igual':
      return atualStr.toLowerCase() === alvo.toLowerCase();
    case 'diferente':
      return atualStr.toLowerCase() !== alvo.toLowerCase();
    case 'contem':
      return atualStr.toLowerCase().includes(alvo.toLowerCase());
    case 'maior':
      return Number(bruto) > Number(alvo);
    case 'menor':
      return Number(bruto) < Number(alvo);
    default:
      return false;
  }
}

/** Substitui o placeholder {card} pelo título do card nas notas. */
function interpolar(texto: string, card: CardDTO): string {
  return texto.replaceAll('{card}', card.titulo);
}

async function executarAcoes(
  businessId: string,
  automationId: string,
  nomeAutomacao: string,
  card: CardDTO,
  acoes: CrmAcao[],
): Promise<void> {
  const db = getDb();
  // Cópia mutável dos valores para ações encadeadas (definir_campo).
  let valoresAtuais = { ...card.valores };
  const feitas: string[] = [];

  try {
    for (const acao of acoes) {
      switch (acao.tipo) {
        case 'mover_card': {
          // Valida que o ponto destino é do mesmo funil.
          const stage = await db
            .select({ id: crmStages.id })
            .from(crmStages)
            .where(
              and(
                eq(crmStages.id, acao.stageId),
                eq(crmStages.businessId, businessId),
                eq(crmStages.pipelineId, card.pipelineId),
              ),
            )
            .limit(1);
          if (stage.length === 0) {
            feitas.push('mover (ponto inválido — ignorado)');
            break;
          }
          // Coloca no fim da coluna destino.
          const noStage = await db
            .select({ ordem: crmCards.ordem })
            .from(crmCards)
            .where(
              and(eq(crmCards.businessId, businessId), eq(crmCards.stageId, acao.stageId)),
            );
          const fim = noStage.reduce((m, c) => Math.max(m, c.ordem + 1), 0);
          await db
            .update(crmCards)
            .set({ stageId: acao.stageId, ordem: fim, updatedAt: new Date() })
            .where(and(eq(crmCards.id, card.id), eq(crmCards.businessId, businessId)));
          feitas.push('moveu o card');
          break;
        }
        case 'definir_campo': {
          valoresAtuais = { ...valoresAtuais, [acao.chave]: acao.valor };
          await db
            .update(crmCards)
            .set({ valores: valoresAtuais, updatedAt: new Date() })
            .where(and(eq(crmCards.id, card.id), eq(crmCards.businessId, businessId)));
          feitas.push(`preencheu ${acao.chave}`);
          break;
        }
        case 'registrar_nota': {
          await criarArtefato({
            businessId,
            autor: 'ceo',
            titulo: interpolar(acao.titulo, card),
            categoria: 'nota',
            conteudo: interpolar(acao.conteudo, card),
            tags: ['automação', 'crm'],
          });
          feitas.push('registrou nota');
          break;
        }
        case 'criar_atividade': {
          const inicio = new Date(Date.now() + acao.emDias * 86_400_000);
          await criarAtividade(businessId, {
            titulo: interpolar(acao.titulo, card),
            tipo: acao.tipoAtividade,
            descricao: acao.descricao ? interpolar(acao.descricao, card) : null,
            inicioEm: inicio.toISOString(),
            diaInteiro: true,
            cardId: card.id,
            contatoId: card.contatoId,
          });
          feitas.push('agendou atividade');
          break;
        }
      }
    }

    await registrarRun(
      businessId,
      automationId,
      card.id,
      'ok',
      `“${nomeAutomacao}” em ${card.titulo}: ${feitas.join('; ')}.`,
    );
  } catch (err) {
    await registrarRun(
      businessId,
      automationId,
      card.id,
      'erro',
      `“${nomeAutomacao}” falhou em ${card.titulo}: ${
        err instanceof Error ? err.message : 'erro'
      }`,
    );
  }
}

async function registrarRun(
  businessId: string,
  automationId: string,
  cardId: string,
  status: CrmAutomationRunStatus,
  mensagem: string,
): Promise<void> {
  try {
    await getDb()
      .insert(crmAutomationRuns)
      .values({ businessId, automationId, cardId, status, mensagem });
  } catch (err) {
    console.error('[crm-automation] falha ao registrar run', err);
  }
}

/* ------------------------------------------------------------------ *
 * Gatilhos temporais (rodam no "tick", não por evento)
 * ------------------------------------------------------------------ */

/**
 * Processa as automações temporais (`card_parado`) de um negócio. Para cada
 * regra ativa, acha os cards parados há ≥ N dias no ponto atual e, se ainda
 * não dispararam nesta estadia (dedupe pelo histórico vs `stageChangedAt`),
 * avalia as condições e executa as ações. Retorna o nº de disparos.
 */
export async function processarTemporais(businessId: string): Promise<number> {
  const db = getDb();
  let disparos = 0;

  const autos = await db
    .select()
    .from(crmAutomations)
    .where(
      and(
        eq(crmAutomations.businessId, businessId),
        eq(crmAutomations.enabled, true),
        eq(crmAutomations.trigger, 'card_parado'),
      ),
    );

  for (const a of autos) {
    const dias = a.triggerDias ?? 0;
    if (dias < 1) continue;
    const limite = new Date(Date.now() - dias * 86_400_000);

    const cards = await db
      .select()
      .from(crmCards)
      .where(
        and(
          eq(crmCards.businessId, businessId),
          eq(crmCards.pipelineId, a.pipelineId),
          lte(crmCards.stageChangedAt, limite),
        ),
      );

    for (const cardRow of cards) {
      // Dedupe: já disparou nesta estadia (run após a entrada no ponto)?
      const jaDisparou = await db
        .select({ id: crmAutomationRuns.id })
        .from(crmAutomationRuns)
        .where(
          and(
            eq(crmAutomationRuns.automationId, a.id),
            eq(crmAutomationRuns.cardId, cardRow.id),
            gte(crmAutomationRuns.createdAt, cardRow.stageChangedAt),
          ),
        )
        .limit(1);
      if (jaDisparou.length > 0) continue;

      const card = cardRowToDTO(cardRow);
      if (!avaliarCondicoes(card, a.condicoes)) continue;
      await executarAcoes(businessId, a.id, a.nome, card, a.acoes);
      disparos++;
    }
  }

  return disparos;
}

/**
 * Versão global do tick (cron): processa os temporais de todos os negócios que
 * têm alguma automação `card_parado` ativa.
 */
export async function processarTemporaisGlobal(): Promise<{
  negocios: number;
  disparos: number;
}> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ businessId: crmAutomations.businessId })
    .from(crmAutomations)
    .where(
      and(eq(crmAutomations.enabled, true), eq(crmAutomations.trigger, 'card_parado')),
    );

  let disparos = 0;
  for (const r of rows) disparos += await processarTemporais(r.businessId);
  return { negocios: rows.length, disparos };
}

/** Resumo textual das automações de um funil, para dar contexto ao agente. */
export async function resumoAutomacoes(
  businessId: string,
  pipelineId: string,
): Promise<string> {
  const lista = await listarAutomacoes(businessId, pipelineId);
  if (lista.length === 0) return 'Nenhuma automação neste funil.';
  return lista
    .map(
      (a) =>
        `- ${a.enabled ? '✅' : '⏸️'} "${a.nome}" (id ${a.id}): gatilho ${a.trigger}` +
        `${a.condicoes.length ? `, ${a.condicoes.length} condição(ões)` : ''}` +
        `, ${a.acoes.length} ação(ões).`,
    )
    .join('\n');
}

/** Re-export do tipo de trigger para callers que montam eventos. */
export type { CrmTrigger };
