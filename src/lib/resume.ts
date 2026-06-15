import { and, desc, eq } from 'drizzle-orm';
import { getRun, start } from 'workflow/api';
import { getDb } from '@/src/db';
import { deliverables, runs } from '@/src/db/schema';
import { getProfile } from '@/src/lib/business';
import { getPersona } from '@/src/agents/registry';
import { personaRunWorkflow } from '@/app/workflows/persona-run';
import type { PersonaRunInput } from '@/src/domain/persona';

/**
 * Retomada de personas que pararam no meio do caminho.
 *
 * O Workflow SDK não reexecuta o journal de um run que falhou (start() sempre
 * cria um run novo, sem chave de idempotência). Então a retomada:
 *  1) checa o STATUS REAL do workflow (getRun(runId).status) — mais confiável
 *     que o nosso `runs.status`, pois pega runs que morreram sem cair no catch
 *     (instância derrubada, timeout, deploy) e ficaram presos em 'working';
 *  2) se o run não está mais rodando, dispara um run NOVO para o MESMO
 *     entregável. O workflow é idempotente (vê o checkpoint de rascunho/conteúdo
 *     do entregável) e pula o que já foi feito → "continua de onde parou".
 */

export type StatusWorkflow =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'desconhecido';

/** Lê o status real do workflow; 'desconhecido' se o run sumiu/expirou. */
export async function statusDoWorkflow(runId: string): Promise<StatusWorkflow> {
  try {
    const status = (await getRun(runId).status) as StatusWorkflow;
    return status ?? 'desconhecido';
  } catch {
    // WorkflowRunNotFoundError ou run expirado — tratamos como retomável.
    return 'desconhecido';
  }
}

export type ResultadoRetomada =
  | { ok: true; runId: string; jaConcluido?: boolean }
  | { ok: false; motivo: 'em_execucao' | 'sem_perfil' | 'nao_encontrado'; statusWorkflow?: StatusWorkflow };

/**
 * Retoma o run de um entregável. Escopado ao negócio do usuário.
 *
 * - Se o entregável já tem conteúdo → no-op (já concluído).
 * - Se o último run ainda está 'running' → recusa (evita rodar em dobro).
 * - Caso contrário → reinicia (run novo, idempotente).
 */
export async function retomarEntregavel(
  businessId: string,
  deliverableId: string,
): Promise<ResultadoRetomada> {
  const db = getDb();

  const [deliverable] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.businessId, businessId),
      ),
    )
    .limit(1);

  if (!deliverable) return { ok: false, motivo: 'nao_encontrado' };

  // Último run registrado para este entregável (o runId mais recente).
  const [ultimoRun] = await db
    .select({ id: runs.id, runId: runs.runId })
    .from(runs)
    .where(
      and(
        eq(runs.deliverableId, deliverableId),
        eq(runs.businessId, businessId),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);

  // Checa o status real do workflow antes de reiniciar.
  let statusWorkflow: StatusWorkflow = 'desconhecido';
  if (ultimoRun) {
    statusWorkflow = await statusDoWorkflow(ultimoRun.runId);
    if (statusWorkflow === 'running') {
      return { ok: false, motivo: 'em_execucao', statusWorkflow };
    }
    // Já concluído de fato + conteúdo salvo: nada a fazer.
    if (statusWorkflow === 'completed' && deliverable.content) {
      return { ok: true, runId: ultimoRun.runId, jaConcluido: true };
    }
  }

  const prof = await getProfile(businessId);
  if (!prof) return { ok: false, motivo: 'sem_perfil', statusWorkflow };

  const persona = getPersona(deliverable.personaId);
  // tarefa: a coluna nova, ou derivada do título ("Persona: <tarefa>") p/ linhas antigas.
  const tarefa =
    deliverable.tarefa ??
    deliverable.titulo.replace(new RegExp(`^${persona.nome}:\\s*`), '');

  // Volta o entregável para 'working' (mantém rascunho/conteúdo como checkpoint).
  await db
    .update(deliverables)
    .set({ status: 'working', updatedAt: new Date() })
    .where(eq(deliverables.id, deliverableId));

  const input: PersonaRunInput = {
    businessId,
    personaId: deliverable.personaId,
    tarefa,
    profile: prof.profile,
    deliverableId,
  };

  const run = await start(personaRunWorkflow, [input]);

  // Atualiza (ou cria) o mapeamento run→entregável para o novo runId.
  if (ultimoRun) {
    await db
      .update(runs)
      .set({ runId: run.runId, status: 'working', updatedAt: new Date() })
      .where(eq(runs.id, ultimoRun.id));
  } else {
    await db.insert(runs).values({
      businessId,
      personaId: deliverable.personaId,
      runId: run.runId,
      deliverableId,
      status: 'working',
    });
  }

  return { ok: true, runId: run.runId };
}
