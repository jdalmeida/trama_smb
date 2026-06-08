import { start } from 'workflow/api';
import { personaRunWorkflow } from '@/app/workflows/persona-run';
import type { OrchestrateInput, PersonaRunInput } from '@/src/domain/persona';

/**
 * Step que dispara um child workflow de persona.
 *
 * `start()` não pode ser chamado diretamente dentro de uma função "use workflow",
 * então embrulhamos a chamada num "use step". Retorna o runId do child para que
 * o orquestrador possa coletá-los (e mapeá-los a runs/streams depois).
 */
async function iniciarPersona(args: PersonaRunInput): Promise<string> {
  'use step';
  console.log('[iniciarPersona] início', {
    personaId: args.personaId,
    deliverableId: args.deliverableId,
  });
  const run = await start(personaRunWorkflow, [args]);
  console.log('[iniciarPersona] fim', { runId: run.runId });
  return run.runId;
}

/**
 * Workflow orquestrador: dispara um child workflow para cada tarefa delegada
 * pelo CEO e devolve os runIds das personas iniciadas.
 */
export async function orchestrateWorkflow(
  input: OrchestrateInput,
): Promise<{ runIds: string[] }> {
  'use workflow';

  const runIds: string[] = [];

  for (const tarefa of input.tarefas) {
    const runId = await iniciarPersona({
      businessId: input.businessId,
      personaId: tarefa.personaId,
      tarefa: tarefa.tarefa,
      profile: input.profile,
      deliverableId: tarefa.deliverableId,
    });
    runIds.push(runId);
  }

  return { runIds };
}
