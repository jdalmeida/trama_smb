import { DurableAgent } from '@workflow/ai/agent';
import { tool } from 'ai';
import { z } from 'zod';
import { modelFor } from '@/src/ai/gateway';
import { buscaWeb } from '@/app/steps/persistir';

/**
 * Persona "Pesquisa de Mercado" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em MarketResearch pelo passo `extrairEntregavel`.
 *
 * A única ferramenta é `buscaWeb` — uma função "use step" (em app/steps/persistir.ts),
 * o que garante retries automáticos e acesso a I/O com observabilidade.
 * Apenas fontes públicas (LGPD): nada de coleta de dados privados.
 */
export function getPesquisaAgent(instructions: string): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: {
      buscaWeb: tool({
        description:
          'Busca na web (somente fontes públicas) por concorrentes, panorama de mercado e segmentos de cliente. Use para embasar a pesquisa com informações reais e cite as URLs.',
        inputSchema: z.object({
          query: z.string().describe('O termo de busca em português'),
        }),
        execute: buscaWeb,
      }),
    },
  });
}
