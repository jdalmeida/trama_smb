'use client';

import * as React from 'react';
import {
  Bot,
  Check,
  Inbox,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type {
  ChannelMessageDTO,
  ConversationDTO,
  InboxItemDTO,
} from '@/src/domain/channels';
import type { ChannelSignalDTO } from '@/src/domain/channel-autopilot';
import { LEAD_SIGNAL_TIPO_LABELS } from '@/src/domain/channel-autopilot';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { PlatformBadge } from '@/components/channels/platform';
import { cn } from '@/lib/utils';

type Thread = {
  conversa: ConversationDTO;
  mensagens: ChannelMessageDTO[];
  sinais: ChannelSignalDTO[];
};

/**
 * Aba "Caixa de entrada": lista de conversas (esquerda) + thread (direita) com
 * composer. Além do envio manual e do rascunho assistido, a thread tem o PILOTO
 * AUTOMÁTICO: depois que o dono iniciou a conversa, ele liga o piloto e o agente
 * passa a responder o lead sozinho, extraindo sinais que o CEO usa para agir
 * (mexer no CRM, disparar pesquisa). Os sinais aparecem no painel da conversa.
 */
export function ChannelInbox({
  conversas,
  onRefresh,
}: {
  conversas: InboxItemDTO[];
  onRefresh: () => void;
}) {
  const [ativaId, setAtivaId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<Thread | null>(null);
  const [texto, setTexto] = React.useState('');
  const [instrucao, setInstrucao] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [rascunhando, setRascunhando] = React.useState(false);
  const [togglando, setTogglando] = React.useState(false);

  // Busca a thread. `silent` (poll) não mexe no que o dono está digitando.
  const carregarThread = React.useCallback(
    async (id: string, opts?: { silent?: boolean }) => {
      try {
        const res = await fetch(`/api/channels/conversations/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as Thread;
        setThread(data);
        if (!opts?.silent) {
          setInstrucao(data.conversa.autopilotInstrucao ?? '');
          onRefresh(); // a conversa foi marcada como lida; atualiza os badges
        }
      } catch {
        // silencioso
      }
    },
    [onRefresh],
  );

  const abrir = React.useCallback(
    async (id: string) => {
      setAtivaId((prev) => {
        if (prev !== id) setTexto(''); // troca de conversa zera o rascunho
        return id;
      });
      await carregarThread(id, { silent: false });
    },
    [carregarThread],
  );

  // Poll da conversa aberta: reflete respostas do piloto e sinais novos sem o
  // dono precisar reabrir a conversa.
  React.useEffect(() => {
    if (!ativaId) return;
    const t = setInterval(() => void carregarThread(ativaId, { silent: true }), 6000);
    return () => clearInterval(t);
  }, [ativaId, carregarThread]);

  async function enviar() {
    if (!thread || !texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/channels/conversations/${thread.conversa.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { erro?: string } | null;
        throw new Error(e?.erro);
      }
      setTexto('');
      await carregarThread(thread.conversa.id, { silent: false });
    } catch (err) {
      toast({
        title:
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível enviar a mensagem',
      });
    } finally {
      setEnviando(false);
    }
  }

  // Rascunho assistido por IA: usa o texto digitado (se houver) como orientação.
  // A IA só sugere — o dono revisa e envia (guardrail).
  async function rascunhar() {
    if (!thread || rascunhando) return;
    setRascunhando(true);
    try {
      const res = await fetch(`/api/channels/conversations/${thread.conversa.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrucao: texto.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { rascunho?: string };
      if (data.rascunho) setTexto(data.rascunho);
    } catch {
      toast({ title: 'Não foi possível gerar o rascunho' });
    } finally {
      setRascunhando(false);
    }
  }

  // Liga/desliga o piloto (e grava a diretriz). O backend barra ligar numa
  // conversa que o dono ainda não iniciou (guardrail).
  async function aplicarAutopilot(ativo: boolean, comInstrucao?: boolean) {
    if (!thread || togglando) return;
    setTogglando(true);
    try {
      const body: { ativo: boolean; instrucao?: string } = { ativo };
      if (comInstrucao || ativo) body.instrucao = instrucao.trim() || undefined;
      const res = await fetch(`/api/channels/conversations/${thread.conversa.id}/autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { erro?: string } | null;
        throw new Error(e?.erro);
      }
      await carregarThread(thread.conversa.id, { silent: true });
      if (ativo && !comInstrucao) {
        toast({
          variant: 'success',
          title: 'Piloto automático ligado',
          description: 'A IA vai responder este lead e avisar o CEO sobre os sinais.',
        });
      } else if (!ativo) {
        toast({ title: 'Piloto automático desligado' });
      } else {
        toast({ variant: 'success', title: 'Diretriz salva' });
      }
    } catch (err) {
      toast({
        title:
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível alterar o piloto automático',
      });
    } finally {
      setTogglando(false);
    }
  }

  async function simularMensagem() {
    const msg = prompt('Mensagem do lead (teste):');
    if (!msg || !msg.trim()) return;
    try {
      const res = await fetch('/api/channels/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'whatsapp', de: 'Lead de teste', texto: msg.trim() }),
      });
      if (!res.ok) throw new Error();
      onRefresh();
      toast({ variant: 'success', title: 'Mensagem de teste recebida' });
    } catch {
      toast({ title: 'Não foi possível simular a mensagem' });
    }
  }

  const autopilotAtivo = thread?.conversa.autopilot ?? false;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[20rem_1fr]">
      {/* Lista de conversas */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Conversas</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void simularMensagem()}
          >
            <MessageSquarePlus className="size-3.5" aria-hidden />
            Simular
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="size-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa ainda. Conecte uma conta ou simule uma mensagem.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void abrir(c.id)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors',
                      ativaId === c.id ? 'bg-primary/10' : 'hover:bg-muted/60',
                    )}
                  >
                    <PlatformBadge
                      platform={c.platform}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.nomeContato ?? c.externalUserId}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {c.autopilot ? (
                            <Bot
                              className="size-3.5 text-primary"
                              aria-label="Piloto automático ligado"
                            />
                          ) : null}
                          {c.naoLidas > 0 ? (
                            <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                              {c.naoLidas}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.ultimaPrevia ?? c.conexaoNome}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        {thread ? (
          <>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
              <PlatformBadge platform={thread.conversa.platform} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {thread.conversa.nomeContato ?? thread.conversa.externalUserId}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {thread.conversa.externalUserId}
                </p>
              </div>
              <Button
                size="sm"
                variant={autopilotAtivo ? 'default' : 'outline'}
                className="shrink-0 gap-1.5"
                onClick={() => void aplicarAutopilot(!autopilotAtivo)}
                disabled={togglando}
                title={
                  autopilotAtivo
                    ? 'Desligar o piloto automático'
                    : 'Ligar o piloto: a IA responde o lead e avisa o CEO'
                }
              >
                {togglando ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Bot className="size-3.5" aria-hidden />
                )}
                {autopilotAtivo ? 'Piloto ligado' : 'Piloto automático'}
              </Button>
            </div>

            {/* Diretriz do piloto + aviso, quando ligado */}
            {autopilotAtivo ? (
              <div className="flex flex-col gap-2 border-b border-border bg-primary/5 px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Bot className="size-3.5 shrink-0 text-primary" aria-hidden />
                  A IA está respondendo este lead e enviando sinais ao CEO, que age no CRM e dispara
                  pesquisas. Você pode assumir a qualquer momento desligando o piloto.
                </p>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={instrucao}
                    onChange={(e) => setInstrucao(e.target.value)}
                    placeholder="Diretriz para a IA (opcional): tom, limites, desconto máximo, objetivo…"
                    rows={1}
                    className="min-h-0 resize-none text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void aplicarAutopilot(true, true)}
                    disabled={togglando}
                  >
                    Salvar diretriz
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
              {thread.mensagens.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                    m.direction === 'entrada'
                      ? 'self-start rounded-bl-sm bg-muted text-foreground'
                      : 'self-end rounded-br-sm bg-primary text-primary-foreground',
                  )}
                >
                  {m.texto ?? <span className="italic opacity-70">[{m.tipo}]</span>}
                  <span className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                    {m.direction === 'saida' && m.automatica ? (
                      <>
                        <Bot className="size-3" aria-hidden />
                        IA ·
                      </>
                    ) : null}
                    {new Date(m.enviadaEm).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Painel de sinais detectados pelo piloto + ação do CEO */}
            {thread.sinais.length > 0 ? (
              <div className="border-t border-border px-4 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  Sinais para o CEO
                </p>
                <ul className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                  {thread.sinais.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-xs">
                      <SignalStatusIcon status={s.status} />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">
                          {LEAD_SIGNAL_TIPO_LABELS[s.tipo]}
                        </span>{' '}
                        <span className="text-muted-foreground">{s.resumo}</span>
                        {s.acaoCeo ? (
                          <span className="mt-0.5 block text-[11px] text-primary/80">
                            CEO: {s.acaoCeo}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Composer: rascunho da IA + envio manual pela plataforma. */}
            <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                placeholder="Escreva uma mensagem…  (Enter envia, Shift+Enter quebra linha)"
                rows={2}
                disabled={enviando}
                className="min-h-0 resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void rascunhar()}
                  disabled={rascunhando || enviando}
                  title="A IA sugere uma resposta com base no perfil do negócio e na conversa"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {rascunhando ? 'Rascunhando…' : 'Rascunhar com IA'}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void enviar()}
                  disabled={!texto.trim() || enviando}
                >
                  <Send className="size-3.5" aria-hidden />
                  {enviando ? 'Enviando…' : 'Enviar'}
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 shrink-0" aria-hidden />
                A IA sugere; você revisa e envia. O contato é sempre conduzido por você.
              </p>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Inbox className="size-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Selecione uma conversa para ver as mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Ícone do estado de um sinal (novo/processando/processado/erro). */
function SignalStatusIcon({ status }: { status: ChannelSignalDTO['status'] }) {
  if (status === 'processado') {
    return <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-label="processado" />;
  }
  if (status === 'processando' || status === 'novo') {
    return (
      <Loader2
        className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground"
        aria-label="processando"
      />
    );
  }
  if (status === 'erro') {
    return <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-label="erro" />;
  }
  return <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={status} />;
}
