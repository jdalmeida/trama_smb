import { start } from 'workflow/api';
import { atendimentoAutopilotWorkflow } from '@/app/workflows/atendimento-run';

/**
 * Dispara o workflow durável do piloto automático para uma conversa.
 *
 * Fica num módulo próprio (e não em src/lib/channels.ts) de propósito: quem
 * chama é o ENTRYPOINT da mensagem (webhook da Meta, webhook da Evolution,
 * simulação), depois de `ingestMensagem` sinalizar `autopilotPendente`. Assim
 * channels.ts não precisa importar o workflow — evita o ciclo de import
 * (channels → workflow → steps → channels).
 *
 * É best-effort: uma falha ao iniciar o run nunca pode derrubar a resposta 200
 * do webhook (a Meta reentregaria o evento).
 */
export async function dispararAtendimentoAutopilot(
  businessId: string,
  conversationId: string,
): Promise<void> {
  try {
    await start(atendimentoAutopilotWorkflow, [{ businessId, conversationId }]);
    console.log('[autopilot] workflow iniciado', { conversationId });
  } catch (err) {
    console.error('[autopilot] falha ao iniciar workflow', {
      conversationId,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}
