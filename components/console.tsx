'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import { MessagesSquare, Sparkles, Users } from 'lucide-react';
import { FileText } from 'lucide-react';
import type { PersonaId } from '@/src/domain/persona';
import { Chat } from '@/components/chat/chat';
import { TeamPanel, type ActiveRun } from '@/components/team/team-panel';
import { ArtifactsPanel } from '@/components/artifacts/artifacts-panel';
import { DeliverablesPanel } from '@/components/deliverables/deliverables-panel';
import {
  ConversationList,
  type Conversa,
} from '@/components/conversations/conversation-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export function Console() {
  // Conversa ativa: um ref (lido pelo transport) + um state (dispara render).
  const conversationIdRef = React.useRef<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, conversationId: conversationIdRef.current },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const {
    conversas,
    carregando: carregandoConversas,
    refresh: refreshConversas,
    setConversas,
  } = useConversas();

  const [carregandoHistorico, setCarregandoHistorico] = React.useState(true);

  // Define a conversa ativa: atualiza ref + state e carrega o histórico dela.
  const selecionar = React.useCallback(
    async (id: string) => {
      conversationIdRef.current = id;
      setActiveId(id);
      setCarregandoHistorico(true);
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (res.ok) {
          const data = (await res.json()) as { mensagens?: UIMessage[] };
          setMessages(data.mensagens ?? []);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setCarregandoHistorico(false);
      }
    },
    [setMessages],
  );

  const novaConversa = React.useCallback(async () => {
    // Se já estamos numa conversa vazia, reutiliza em vez de criar outra.
    const atual = conversas.find((c) => c.id === activeId);
    if (atual && atual.mensagens === 0 && messages.length === 0) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { conversa: Conversa };
      setConversas((prev) => [data.conversa, ...prev]);
      conversationIdRef.current = data.conversa.id;
      setActiveId(data.conversa.id);
      setMessages([]);
      setCarregandoHistorico(false);
    } catch {
      // silencioso
    }
  }, [activeId, conversas, messages.length, setConversas, setMessages]);

  // Bootstrap: escolhe a conversa mais recente ou cria a primeira.
  const bootstrapped = React.useRef(false);
  React.useEffect(() => {
    if (bootstrapped.current || carregandoConversas) return;
    bootstrapped.current = true;
    if (conversas.length > 0) {
      void selecionar(conversas[0].id);
    } else {
      void novaConversa();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoConversas]);

  // Quando uma resposta termina, atualiza a lista (título auto + ordem).
  const statusAnterior = React.useRef(status);
  React.useEffect(() => {
    if (statusAnterior.current !== 'ready' && status === 'ready') {
      void refreshConversas();
    }
    statusAnterior.current = status;
  }, [status, refreshConversas]);

  const renomear = React.useCallback(
    async (id: string, titulo: string) => {
      setConversas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, titulo } : c)),
      );
      try {
        await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo }),
        });
      } catch {
        void refreshConversas();
      }
    },
    [refreshConversas, setConversas],
  );

  const apagar = React.useCallback(
    async (id: string) => {
      setConversas((prev) => prev.filter((c) => c.id !== id));
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      } catch {
        void refreshConversas();
      }
      if (id === activeId) {
        const resto = conversas.filter((c) => c.id !== id);
        if (resto.length > 0) void selecionar(resto[0].id);
        else void novaConversa();
      }
    },
    [activeId, conversas, novaConversa, refreshConversas, selecionar, setConversas],
  );

  // Runs do painel "Time": derivados do chat + vindos do banco.
  const chatRuns = React.useMemo(() => extrairRuns(messages), [messages]);
  const apiRuns = useApiRuns();
  const runs = React.useMemo(
    () => mesclarRuns(chatRuns, apiRuns),
    [chatRuns, apiRuns],
  );

  // Visão principal: o chat (com a sidebar de conversas/time) ou uma página
  // full-width de Entregáveis/Artefatos — mais larga e fácil de ler.
  const [mainView, setMainView] = React.useState<
    'chat' | 'entregaveis' | 'artefatos'
  >('chat');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ViewSwitcher view={mainView} onChange={setMainView} />

      {mainView === 'chat' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
          {/* Chat ocupa o espaço principal */}
          <section className="flex min-h-0 flex-col rounded-xl border border-border bg-background p-4 shadow-sm">
            <Chat
              messages={messages}
              sendMessage={sendMessage}
              status={status}
              carregandoHistorico={carregandoHistorico}
            />
          </section>

          {/* Sidebar: conversas + time */}
          <aside className="flex min-h-0 flex-col">
            <Tabs
              defaultValue="conversas"
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="w-full">
                <TabsTrigger value="conversas" className="gap-1.5">
                  <MessagesSquare className="size-3.5" aria-hidden />
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="time" className="gap-1.5">
                  <Users className="size-3.5" aria-hidden />
                  Time
                </TabsTrigger>
              </TabsList>

              <div className="mt-3 min-h-0 flex-1 rounded-xl border border-border bg-background p-3 shadow-sm">
                <TabsContent value="conversas" className="mt-0 h-full">
                  <ConversationList
                    conversas={conversas}
                    activeId={activeId}
                    carregando={carregandoConversas}
                    onSelect={(id) => void selecionar(id)}
                    onNew={() => void novaConversa()}
                    onRename={(id, t) => void renomear(id, t)}
                    onDelete={(id) => void apagar(id)}
                  />
                </TabsContent>
                <TabsContent value="time" className="mt-0 h-full overflow-y-auto">
                  <TeamPanel runs={runs} />
                </TabsContent>
              </div>
            </Tabs>
          </aside>
        </div>
      ) : (
        // Página full-width (Entregáveis ou Artefatos), em coluna legível.
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            {mainView === 'entregaveis' ? (
              <DeliverablesPanel />
            ) : (
              <ArtifactsPanel />
            )}
          </div>
        </section>
      )}

      <Toaster />
    </div>
  );
}

/** Seletor da visão principal: Chat · Entregáveis · Artefatos. */
function ViewSwitcher({
  view,
  onChange,
}: {
  view: 'chat' | 'entregaveis' | 'artefatos';
  onChange: (v: 'chat' | 'entregaveis' | 'artefatos') => void;
}) {
  const itens = [
    { id: 'chat' as const, label: 'Chat', Icon: MessagesSquare },
    { id: 'entregaveis' as const, label: 'Entregáveis', Icon: FileText },
    { id: 'artefatos' as const, label: 'Artefatos', Icon: Sparkles },
  ];
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {itens.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={view === id}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Busca e mantém a lista de conversas do negócio. */
function useConversas() {
  const [conversas, setConversas] = React.useState<Conversa[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = (await res.json()) as { conversas?: Conversa[] };
      setConversas(data.conversas ?? []);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { conversas, carregando, refresh, setConversas };
}

/**
 * Busca os runs do negócio em GET /api/runs (na montagem + poll leve a cada 5s)
 * para o painel "Time" reconectar streams após refresh.
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
        // silencioso
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
 * Deriva runs ativos a partir dos outputs da tool delegarTarefa
 * (state "output-available"): { deliverableId, runId, personaId }.
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
