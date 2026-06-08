import { DurableAgent } from '@workflow/ai/agent';
import { tool } from 'ai';
import { z } from 'zod';
import { modelFor } from '@/src/ai/gateway';
import { buscaWeb } from '@/app/steps/persistir';

/**
 * Persona "Conteúdo & Aquisição" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em ContentPlan pelo passo `extrairEntregavel`.
 *
 * A única ferramenta é `buscaWeb` — uma função "use step" (em app/steps/persistir.ts),
 * o que garante retries automáticos e acesso a I/O com observabilidade.
 */
export function getConteudoAgent(instructions: string): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: {
      buscaWeb: tool({
        description:
          'Busca na web (fontes públicas) por referências, tendências, concorrentes e ideias de conteúdo. Use para embasar o plano com informações reais.',
        inputSchema: z.object({
          query: z.string().describe('O termo de busca em português'),
        }),
        execute: buscaWeb,
      }),
    },
  });
}
