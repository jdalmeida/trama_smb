import { ToolLoopAgent, stepCountIs } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { buildInstructions } from '@/src/lib/skills';
import { crmTools, type CrmAgentContext } from './tools';

/**
 * Agente CRM — especialista que configura e opera o CRM data-driven do negócio.
 *
 * É um agente de chat interativo (ToolLoopAgent, como o CEO), porque as ações
 * de configuração/operação precisam refletir na hora no banco e na UI — não é
 * um worker durável que produz entregável. Pode ser acionado direto pelo dono
 * (aba CRM) ou pelo CEO via a tool `delegarAoCrm`.
 */
export function getCrmAgent(ctx: CrmAgentContext): ToolLoopAgent {
  return new ToolLoopAgent({
    model: modelFor('reasoning'),
    instructions: buildInstructions('crm'),
    tools: crmTools(ctx),
    stopWhen: stepCountIs(20),
  });
}
