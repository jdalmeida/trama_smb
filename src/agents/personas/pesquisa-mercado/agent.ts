import { DurableAgent } from '@workflow/ai/agent';
import { modelFor } from '@/src/ai/gateway';
import { personaTools, type PersonaToolsContext } from '@/src/agents/personas/tools';

/**
 * Persona "Pesquisa de Mercado" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em MarketResearch pelo passo `extrairEntregavel`.
 *
 * As ferramentas vêm do toolset compartilhado (src/agents/personas/tools.ts):
 * internet (somente fontes públicas — LGPD: nada de coleta de dados privados)
 * + memória da empresa + entregáveis anteriores. Cada execute é "use step".
 */
export function getPesquisaAgent(
  instructions: string,
  ctx: PersonaToolsContext,
): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: personaTools(ctx),
  });
}
