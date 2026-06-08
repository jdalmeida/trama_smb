'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import type { PersonaId } from '@/src/domain/persona';
import { Chat } from '@/components/chat/chat';
import { TeamPanel, type ActiveRun } from '@/components/team/team-panel';

export function Console() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const runs = React.useMemo(() => extrairRuns(messages), [messages]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="flex min-h-0 flex-col rounded-xl border border-black/10 bg-[var(--color-canvas)] p-4 lg:col-span-2">
        <Chat messages={messages} sendMessage={sendMessage} status={status} />
      </section>
      <section className="min-h-0 lg:col-span-1">
        <TeamPanel runs={runs} />
      </section>
    </div>
  );
}

/**
 * Deriva a lista de runs ativos a partir dos outputs da tool delegarTarefa
 * (state "output-available"). O output traz { deliverableId, runId, personaId, persona }.
 * Deduplica por runId, mantendo a primeira ocorrência.
 */
function extrairRuns(messages: UIMessage[]): ActiveRun[] {
  const vistos = new Set<string>();
  const runs: ActiveRun[] = [];

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (!isToolUIPart(part)) continue;
      const nome = part.type.startsWith('tool-')
        ? part.type.slice('tool-'.length)
        : part.type;
      if (nome !== 'delegarTarefa') continue;
      if (part.state !== 'output-available') continue;

      const output = 'output' in part ? part.output : undefined;
      if (typeof output !== 'object' || output === null) continue;
      const o = output as Record<string, unknown>;

      const runId = typeof o.runId === 'string' ? o.runId : undefined;
      const deliverableId =
        typeof o.deliverableId === 'string' ? o.deliverableId : undefined;
      const personaId =
        typeof o.personaId === 'string'
          ? (o.personaId as PersonaId)
          : undefined;

      if (!runId || !deliverableId || !personaId) continue;
      if (vistos.has(runId)) continue;
      vistos.add(runId);
      runs.push({ runId, deliverableId, personaId });
    }
  }

  return runs;
}
