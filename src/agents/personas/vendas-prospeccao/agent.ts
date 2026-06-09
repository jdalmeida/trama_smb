import { DurableAgent } from '@workflow/ai/agent';
import { tool } from 'ai';
import { z } from 'zod';
import { modelFor } from '@/src/ai/gateway';
import { buscaWeb } from '@/app/steps/persistir';

/**
 * Persona "Vendas / Prospecção" como agente durável.
 *
 * Recebe o perfil do negócio + a tarefa do CEO e produz um rascunho (texto)
 * que depois é estruturado em ProspectingPlan pelo passo `extrairEntregavel`.
 *
 * Guardrail (LGPD/CDC): mapeia somente oportunidades/canais PÚBLICOS — nunca
 * contatos pessoais nem outreach automatizado; o contato é sempre do dono.
 *
 * A única ferramenta é `buscaWeb` — uma função "use step" (em app/steps/persistir.ts),
 * o que garante retries automáticos e acesso a I/O com observabilidade.
 */
export function getVendasAgent(instructions: string): DurableAgent {
  return new DurableAgent({
    model: modelFor('worker'),
    instructions,
    tools: {
      buscaWeb: tool({
        description:
          'Busca na web (fontes públicas) por eventos, feiras, marketplaces, associações comerciais, licitações e parcerias locais para captação de clientes. Nunca use para buscar contatos de pessoas físicas.',
        inputSchema: z.object({
          query: z.string().describe('O termo de busca em português'),
        }),
        execute: buscaWeb,
      }),
    },
  });
}
