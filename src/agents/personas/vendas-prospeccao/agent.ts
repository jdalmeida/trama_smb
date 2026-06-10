import { DurableAgent } from '@workflow/ai/agent';
import { modelFor } from '@/src/ai/gateway';
import { personaTools, type PersonaToolsContext } from '@/src/agents/personas/tools';

/**
 * Persona "Vendas / Prospecção" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em ProspectingPlan pelo passo `extrairEntregavel`.
 *
 * Guardrail (LGPD/CDC): mapeia somente oportunidades/canais PÚBLICOS — nunca
 * contatos pessoais nem outreach automatizado; o contato é sempre do dono.
 *
 * As ferramentas vêm do toolset compartilhado (src/agents/personas/tools.ts):
 * internet (somente fontes públicas) + memória da empresa + entregáveis
 * anteriores. Cada execute é uma função "use step" — retries e observabilidade.
 */
export function getVendasAgent(
  instructions: string,
  ctx: PersonaToolsContext,
): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: personaTools(ctx),
  });
}
