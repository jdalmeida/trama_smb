'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import type { PersonaId } from '@/src/domain/persona';
import { Chat } from '@/components/chat/chat';
import { TeamPanel, type ActiveRun } from '@/components/team/team-panel';
import { MemoryPanel } from '@/components/memory/memory-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Console() {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  // Hidrata o chat com o histórico persistido (GET /api/chat/history).
  const carregandoHistorico = useHistoricoChat(setMessages);

  // Runs derivados do chat (delegarTarefa) — feedback instantâneo.
  const chatRuns = React.useMemo(() => extrairRuns(messages), [messages]);

  // Runs vindos do banco (GET /api/runs) — descobre os runs filhos do
  // orquestrador (delegarPlano) e reconecta após refresh. Poll leve.
  const apiRuns = useApiRuns();

  const runs = React.useMemo(
    () => mesclarRuns(chatRuns, apiRuns),
    [chatRuns, apiRuns],
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-background p-4 shadow-sm lg:col-span-2">
        <Chat
          messages={messages}
          sendMessage={sendMessage}
          status={status}
          carregandoHistorico={carregandoHistorico}
        />
      </section>
      <section className="min-h-0 lg:col-span-1">
        <Tabs defaultValue="time">
          <TabsList className="w-full">
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="memoria">Memória</TabsTrigger>
          </TabsList>
          <TabsContent value="time">
            <TeamPanel runs={runs} />
          </TabsContent>
          <TabsContent value="memoria">
            <MemoryPanel />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

/**
 * Carrega o histórico do chat na montagem e mescla com as mensagens já
 * presentes no useChat (dedup por id — o que está na tela tem precedência,
 * então nada duplica nem some se o usuário já enviou algo). As parts das
 * mensagens restauradas vêm intactas do banco, então extrairRuns continua
 * reconstruindo os runs do painel Time normalmente.
 */
function useHistoricoChat(
  setMessages: (
    updater: UIMessage[] | ((atuais: UIMessage[]) => UIMessage[]),
  ) => void,
): boolean {
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const res = await fetch('/api/chat/history');
        if (!res.ok) return;
        const data = (await res.json()) as { mensagens?: UIMessage[] };
        const historico = data.mensagens ?? [];
        if (!vivo || historico.length === 0) return;
        setMessages((atuais) => {
          const idsAtuais = new Set(atuais.map((m) => m.id));
          return [
            ...historico.filter((m) => !idsAtuais.has(m.id)),
            ...atuais,
          ];
        });
      } catch {
        // silencioso — o chat segue funcionando sem o histórico
      } finally {
        if (vivo) setCarregando(false);
      }
    };
    void carregar();
    return () => {
      vivo = false;
    };
  }, [setMessages]);

  return carregando;
}

/**
 * Busca os runs do negócio em GET /api/runs (na montagem + poll leve a cada 5s).
 * É como os runs filhos do orquestrador (delegarPlano) aparecem no painel, e
 * como reconectamos os streams após um refresh da página.
 */
function useApiRuns(): ActiveRun[] {
  const [runs, setRuns] = React.useState<ActiveRun[]>([]);

  React.useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const res = await fetch('/api/runs');
        if (!res.ok) return;
        const data = (await res.json()) as {
          runs?: {
            runId: string;
            personaId: PersonaId;
            deliverableId: string | null;
          }[];
        };
        if (!vivo) return;
        const mapeados = (data.runs ?? [])
          .filter((r) => r.deliverableId)
          .map((r) => ({
            runId: r.runId,
            personaId: r.personaId,
            deliverableId: r.deliverableId as string,
          }));
        setRuns(mapeados);
      } catch {
        // silencioso — o painel continua com os runs derivados do chat
      }
    };
    void carregar();
    const id = setInterval(() => void carregar(), 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return runs;
}

/** Mescla runs do chat e do banco, deduplicando por runId. */
function mesclarRuns(a: ActiveRun[], b: ActiveRun[]): ActiveRun[] {
  const vistos = new Set<string>();
  const out: ActiveRun[] = [];
  for (const r of [...a, ...b]) {
    if (vistos.has(r.runId)) continue;
    vistos.add(r.runId);
    out.push(r);
  }
  return out;
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
