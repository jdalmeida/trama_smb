import { ToolLoopAgent, stepCountIs } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { buildInstructions } from '@/src/lib/skills';
import { ceoTools, type CeoContext } from './tools';

/**
 * Agente CEO — orquestrador interativo que conversa com o usuário.
 *
 * Usa o tier "reasoning" (decisões/planejamento), instruções vindas do playbook
 * `ceo` e as tools de orquestração (perfil, plano, delegação). O loop de tools
 * é limitado a 16 passos para evitar laços longos numa única resposta.
 */
export function getCeoAgent(ctx: CeoContext): ToolLoopAgent {
  return new ToolLoopAgent({
    model: modelFor('reasoning'),
    instructions: buildInstructions('ceo'),
    tools: ceoTools(ctx),
    stopWhen: stepCountIs(16),
  });
}
