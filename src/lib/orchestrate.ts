import { start } from 'workflow/api';
import { getDb } from '@/src/db';
import { deliverables } from '@/src/db/schema';
import { getPersona } from '@/src/agents/registry';
import { orchestrateWorkflow } from '@/app/workflows/orchestrate';
import type { BusinessProfile } from '@/src/domain/business-profile';
import type { OrchestrateInput, PersonaId } from '@/src/domain/persona';

export interface TarefaPlano {
  personaId: PersonaId;
  tarefa: string;
}

export interface PlanoIniciado {
  orchestratorRunId: string;
  itens: { deliverableId: string; personaId: PersonaId; titulo: string }[];
}

/**
 * Pré-cria os entregáveis (um por tarefa) e dispara o workflow ORQUESTRADOR,
 * que por sua vez inicia um run durável por persona e registra cada um em `runs`
 * (para a UI descobrir os runs filhos via GET /api/runs).
 *
 * Usado pela rota POST /api/orchestrate e pela tool `delegarPlano` do CEO.
 * Roda em contexto Node (rota/route handler) — não em "use workflow".
 */
export async function iniciarPlano(
  businessId: string,
  profile: BusinessProfile,
  tarefas: TarefaPlano[],
): Promise<PlanoIniciado> {
  const db = getDb();

  const itens: PlanoIniciado['itens'] = [];
  const tarefasComEntregavel: OrchestrateInput['tarefas'] = [];

  for (const t of tarefas) {
    const persona = getPersona(t.personaId);
    const [deliverable] = await db
      .insert(deliverables)
      .values({
        businessId,
        personaId: t.personaId,
        titulo: `${persona.nome}: ${t.tarefa}`,
        tarefa: t.tarefa,
        status: 'working',
      })
      .returning();

    itens.push({
      deliverableId: deliverable.id,
      personaId: t.personaId,
      titulo: deliverable.titulo,
    });
    tarefasComEntregavel.push({
      personaId: t.personaId,
      tarefa: t.tarefa,
      deliverableId: deliverable.id,
    });
  }

  const input: OrchestrateInput = {
    businessId,
    profile,
    tarefas: tarefasComEntregavel,
  };
  const run = await start(orchestrateWorkflow, [input]);

  return { orchestratorRunId: run.runId, itens };
}
