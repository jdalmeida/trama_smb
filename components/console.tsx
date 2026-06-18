'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import {
  Brain,
  FileText,
  KanbanSquare,
  MessagesSquare,
  Radio,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Visões principais do console. As cinco primeiras vivem no seletor do topo;
 * 'perfil' (o Perfil do Negócio) é acessível pelo menu do usuário, no header —
 * é contexto/configuração, não uma visão de trabalho do dia a dia.
 * O id 'perfil' renderiza o MemoriesPanel.
 */
type MainView = 'chat' | 'canais' | 'crm' | 'entregaveis' | 'memoria' | 'perfil';

/**
 * Destinos do seletor principal. Renderizados como segmented control no topo
 * (desktop) e como barra de navegação inferior (mobile). 'perfil' fica fora —
 * vive no menu do usuário, no header.
 */
const MAIN_VIEWS: { id: MainView; label: string; Icon: LucideIcon }[] = [
  { id: 'chat', label: 'Chat', Icon: MessagesSquare },
  { id: 'canais', label: 'Canais', Icon: Radio },
  { id: 'crm', label: 'CRM', Icon: KanbanSquare },
  { id: 'entregaveis', label: 'Entregáveis', Icon: FileText },
  { id: 'memoria', label: 'Memória', Icon: Brain },
];

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
  // full-width (CRM, Canais, Entregáveis, Memória ou Perfil).
  const [mainView, setMainView] = React.useState<MainView>('chat');
  const verPerfil = mainView === 'perfil';

  // Mobile: a sidebar de Conversas/Time não cabe ao lado do chat, então no
  // celular elas viram abas em tela cheia. 'mobilePane' decide o que ocupa a
  // tela; 'sidebarTab' é compartilhada com as abas do desktop.
  const [mobilePane, setMobilePane] = React.useState<'conversa' | 'sidebar'>(
    'conversa',
  );
  const [sidebarTab, setSidebarTab] = React.useState<'conversas' | 'time'>(
    'conversas',
  );

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[100rem] items-center justify-between px-4 sm:px-6">
          <div className="flex h-6 items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                🧵
              </span>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Trama
              </span>
            </div>
            <Separator orientation="vertical" />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Seu time de agentes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={verPerfil ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              aria-pressed={verPerfil}
              onClick={() => setMainView(verPerfil ? 'chat' : 'perfil')}
            >
              <Store className="size-4" aria-hidden />
              <span className="hidden sm:inline">Perfil do negócio</span>
            </Button>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[100rem] flex-1 flex-col px-4 py-4 sm:px-6">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <ViewSwitcher view={mainView} onChange={setMainView} />

          {mainView === 'chat' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {/* Mobile: a sidebar não cabe ao lado do chat, então Conversa,
                  Conversas e Time viram abas em tela cheia. No desktop esta
                  sub-nav some e tudo aparece lado a lado. */}
              <div
                role="group"
                aria-label="Visão do chat"
                className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1 lg:hidden"
              >
                <ChatPaneTab
                  active={mobilePane === 'conversa'}
                  onClick={() => setMobilePane('conversa')}
                  Icon={MessagesSquare}
                  label="Conversa"
                />
                <ChatPaneTab
                  active={mobilePane === 'sidebar' && sidebarTab === 'conversas'}
                  onClick={() => {
                    setMobilePane('sidebar');
                    setSidebarTab('conversas');
                  }}
                  Icon={MessagesSquare}
                  label="Conversas"
                />
                <ChatPaneTab
                  active={mobilePane === 'sidebar' && sidebarTab === 'time'}
                  onClick={() => {
                    setMobilePane('sidebar');
                    setSidebarTab('time');
                  }}
                  Icon={Users}
                  label="Time"
                />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
                {/* Chat ocupa o espaço principal (escondido no mobile quando a
                    sub-nav está na sidebar). */}
                <section
                  className={cn(
                    'min-h-0 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10',
                    mobilePane === 'conversa' ? 'flex' : 'hidden lg:flex',
                  )}
                >
                  <Chat
                    messages={messages}
                    sendMessage={sendMessage}
                    status={status}
                    carregandoHistorico={carregandoHistorico}
                    perfilVerificado={perfil.verified}
                    onConfirmarPerfil={perfil.confirmar}
                  />
                </section>

                {/* Sidebar: abas Conversas/Time no desktop; no mobile a sub-nav
                    acima controla qual painel aparece (Tabs controlado). */}
                <aside
                  className={cn(
                    'min-h-0 flex-col',
                    mobilePane === 'sidebar' ? 'flex' : 'hidden lg:flex',
                  )}
                >
                  <Tabs
                    value={sidebarTab}
                    onValueChange={(v) =>
                      setSidebarTab(v as 'conversas' | 'time')
                    }
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="hidden w-full lg:inline-flex">
                      <TabsTrigger value="conversas" className="gap-1.5">
                        <MessagesSquare className="size-3.5" aria-hidden />
                        Conversas
                      </TabsTrigger>
                      <TabsTrigger value="time" className="gap-1.5">
                        <Users className="size-3.5" aria-hidden />
                        Time
                      </TabsTrigger>
                    </TabsList>

                    <div className="min-h-0 flex-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10 lg:mt-3">
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
                      <TabsContent
                        value="time"
                        className="mt-0 h-full overflow-y-auto"
                      >
                        <TeamPanel runs={runs} />
                      </TabsContent>
                    </div>
                  </Tabs>
                </aside>
              </div>
            </div>
          ) : mainView === 'crm' ? (
            // CRM: full-width de verdade (o kanban precisa de espaço horizontal).
            <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
              <CrmPanel />
            </section>
          ) : mainView === 'canais' ? (
            // Canais: full-width (inbox + thread precisam de espaço horizontal).
            <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
              <ChannelsPanel />
            </section>
          ) : (
            // Página full-width (Entregáveis, Memória ou Perfil), em coluna legível.
            <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
              <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
                {mainView === 'entregaveis' ? (
                  <DeliverablesPanel />
                ) : mainView === 'memoria' ? (
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
        </div>
      </div>

      <BottomNav view={mainView} onChange={setMainView} />

      <Toaster />
    </main>
  );
}

/**
 * Seletor da visão principal (desktop): segmented control no topo.
 * No mobile some — a navegação vira a barra inferior (BottomNav).
 */
function ViewSwitcher({
  view,
  onChange,
}: {
  view: MainView;
  onChange: (v: MainView) => void;
}) {
  return (
    <div className="hidden w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 md:inline-flex">
      {MAIN_VIEWS.map(({ id, label, Icon }) => (
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

/**
 * Navegação principal no mobile: barra inferior thumb-first. No fluxo da coluna
 * (o <main> é h-screen), então fica colada na base sem position fixed; respeita
 * o safe-area-inset dos aparelhos com home indicator.
 */
function BottomNav({
  view,
  onChange,
}: {
  view: MainView;
  onChange: (v: MainView) => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {MAIN_VIEWS.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={cn(
              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** Botão da sub-nav do chat no mobile (Conversa · Conversas · Time). */
function ChatPaneTab({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
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
 * aparece no chat e o que a aba "Perfil do negócio" exibe.
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
