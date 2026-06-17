'use client';

import * as React from 'react';
import { Inbox, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import type {
  ChannelMessageDTO,
  ConversationDTO,
  InboxItemDTO,
} from '@/src/domain/channels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { PlatformBadge } from '@/components/channels/platform';
import { cn } from '@/lib/utils';

/**
 * Aba "Caixa de entrada": lista de conversas (esquerda) + thread read-only
 * (direita). Esta leva é só de RECEBIMENTO — o envio (com rascunho da IA) chega
 * numa próxima leva, então o campo de resposta aparece desabilitado.
 */
export function ChannelInbox({
  conversas,
  onRefresh,
}: {
  conversas: InboxItemDTO[];
  onRefresh: () => void;
}) {
  const [ativaId, setAtivaId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<{
    conversa: ConversationDTO;
    mensagens: ChannelMessageDTO[];
  } | null>(null);
  const [texto, setTexto] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [rascunhando, setRascunhando] = React.useState(false);

  const abrir = React.useCallback(
    async (id: string) => {
      setAtivaId((prev) => {
        if (prev !== id) setTexto(''); // troca de conversa zera o rascunho
        return id;
      });
      try {
        const res = await fetch(`/api/channels/conversations/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversa: ConversationDTO;
          mensagens: ChannelMessageDTO[];
        };
        setThread(data);
        onRefresh(); // a conversa foi marcada como lida; atualiza os badges
      } catch {
        // silencioso
      }
    },
    [onRefresh],
  );

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
      await abrir(thread.conversa.id);
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

  async function simularMensagem() {
    const texto = prompt('Mensagem do lead (teste):');
    if (!texto || !texto.trim()) return;
    try {
      const res = await fetch('/api/channels/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'whatsapp', de: 'Lead de teste', texto: texto.trim() }),
      });
      if (!res.ok) throw new Error();
      onRefresh();
      toast({ variant: 'success', title: 'Mensagem de teste recebida' });
    } catch {
      toast({ title: 'Não foi possível simular a mensagem' });
    }
  }

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
                        {c.naoLidas > 0 ? (
                          <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                            {c.naoLidas}
                          </Badge>
                        ) : null}
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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {thread.conversa.nomeContato ?? thread.conversa.externalUserId}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {thread.conversa.externalUserId}
                </p>
              </div>
            </div>

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
                  <span className="mt-1 block text-[10px] opacity-60">
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
