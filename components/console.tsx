'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import { Brain, KanbanSquare, MessagesSquare, Radio, Sparkles, Users } from 'lucide-react';
import { FileText } from 'lucide-react';
import type { PersonaId, PersonaStatus } from '@/src/domain/persona';
import type { BusinessProfile } from '@/src/domain/business-profile';
import { Chat } from '@/components/chat/chat';
import { TeamPanel, type ActiveRun } from '@/components/team/team-panel';
import { ArtifactsPanel } from '@/components/artifacts/artifacts-panel';
import { DeliverablesPanel } from '@/components/deliverables/deliverables-panel';
import { MemoriesPanel } from '@/components/memories/memories-panel';
import { CrmPanel } from '@/components/crm/crm-panel';
import { ChannelsPanel } from '@/components/channels/channels-panel';
import {
  ConversationList,
  type Conversa,
} from '@/components/conversations/conversation-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/** Visões principais do console (seletor no topo). */
type MainView = 'chat' | 'canais' | 'entregaveis' | 'artefatos' | 'memorias' | 'crm';

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

  const perfil = usePerfilNegocio();

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

  // Quando uma resposta termina, atualiza a lista (título auto + ordem) e
  // re-busca o perfil — o CEO pode ter chamado salvarPerfil no meio da resposta
  // (perfil volta a "não verificado" e o card de confirmação reaparece no chat).
  const statusAnterior = React.useRef(status);
  React.useEffect(() => {
    if (statusAnterior.current !== 'ready' && status === 'ready') {
      void refreshConversas();
      void perfil.refresh();
    }
    statusAnterior.current = status;
  }, [status, refreshConversas, perfil]);

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
  const [mainView, setMainView] = React.useState<MainView>('chat');

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
              perfilVerificado={perfil.verified}
              onConfirmarPerfil={perfil.confirmar}
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
      ) : mainView === 'crm' ? (
        // CRM: full-width de verdade (o kanban precisa de espaço horizontal).
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6">
          <CrmPanel />
        </section>
      ) : mainView === 'canais' ? (
        // Canais: full-width (inbox + thread precisam de espaço horizontal).
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6">
          <ChannelsPanel />
        </section>
      ) : (
        // Página full-width (Entregáveis, Artefatos ou Memórias), em coluna legível.
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            {mainView === 'entregaveis' ? (
              <DeliverablesPanel />
            ) : mainView === 'artefatos' ? (
              <ArtifactsPanel />
            ) : (
              <MemoriesPanel
                profile={perfil.profile}
                verified={perfil.verified}
                carregando={perfil.carregando}
                onConfirmar={perfil.confirmar}
              />
            )}
          </div>
        </section>
      )}

      <Toaster />
    </div>
  );
}

/** Seletor da visão principal: Chat · CRM · Entregáveis · Artefatos · Memórias. */
function ViewSwitcher({
  view,
  onChange,
}: {
  view: MainView;
  onChange: (v: MainView) => void;
}) {
  const itens = [
    { id: 'chat' as const, label: 'Chat', Icon: MessagesSquare },
    { id: 'canais' as const, label: 'Canais', Icon: Radio },
    { id: 'crm' as const, label: 'CRM', Icon: KanbanSquare },
    { id: 'entregaveis' as const, label: 'Entregáveis', Icon: FileText },
    { id: 'artefatos' as const, label: 'Artefatos', Icon: Sparkles },
    { id: 'memorias' as const, label: 'Memórias', Icon: Brain },
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
 * Estado do Perfil do Negócio (a "memória" do negócio): conteúdo + se já foi
 * verificado pelo dono. É a fonte única que decide se o card de confirmação
 * aparece no chat e o que a aba "Memórias" exibe.
 */
function usePerfilNegocio() {
  const [profile, setProfile] = React.useState<BusinessProfile | null>(null);
  const [verified, setVerified] = React.useState<boolean | null>(null);
  const [carregando, setCarregando] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      const data = (await res.json()) as {
        profile?: BusinessProfile | null;
        verified?: boolean;
      };
      setProfile(data.profile ?? null);
      setVerified(data.verified ?? false);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Confirma o perfil: marca como verificado (otimista) e persiste.
  const confirmar = React.useCallback(async (p: BusinessProfile) => {
    setProfile(p);
    setVerified(true);
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: p, verified: true }),
    });
    if (!res.ok) {
      // Reverte o otimismo para o usuário poder tentar de novo.
      setVerified(false);
      throw new Error('Falha ao confirmar o perfil');
    }
  }, []);

  return { profile, verified, carregando, refresh, confirmar };
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
            status?: PersonaStatus;
          }[];
        };
        if (!vivo) return;
        const mapeados = (data.runs ?? [])
          .filter((r) => r.deliverableId)
          .map((r) => ({
            runId: r.runId,
            personaId: r.personaId,
            deliverableId: r.deliverableId as string,
            status: r.status,
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

/**
 * Mescla runs do chat e do banco por runId. Os do chat não trazem status; os do
 * banco (b) trazem runs.status. Em vez de descartar o duplicado, fundimos os
 * campos para não perder o status persistido (que hidrata o painel "Time").
 */
function mesclarRuns(a: ActiveRun[], b: ActiveRun[]): ActiveRun[] {
  const porId = new Map<string, ActiveRun>();
  for (const r of [...a, ...b]) {
    const existente = porId.get(r.runId);
    porId.set(
      r.runId,
      existente
        ? { ...existente, ...r, status: r.status ?? existente.status }
        : r,
    );
  }
  return [...porId.values()];
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
