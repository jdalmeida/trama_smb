import { DurableAgent } from '@workflow/ai/agent';
import { modelFor } from '@/src/ai/gateway';
import { personaTools, type PersonaToolsContext } from '@/src/agents/personas/tools';

/**
 * Persona "Conteúdo & Aquisição" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em ContentPlan pelo passo `extrairEntregavel`.
 *
 * As ferramentas vêm do toolset compartilhado (src/agents/personas/tools.ts):
 * internet (somente fontes públicas) + memória da empresa + entregáveis
 * anteriores. Cada execute é uma função "use step" — retries e observabilidade.
 */
export function getConteudoAgent(
  instructions: string,
  ctx: PersonaToolsContext,
): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: personaTools(ctx),
  });
}
