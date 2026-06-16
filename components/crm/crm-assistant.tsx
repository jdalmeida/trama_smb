'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sparkles } from 'lucide-react';
import { MessageParts } from '@/components/chat/message-parts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendIcon, type SendIconHandle } from '@/components/ui/send';

const SUGESTOES = [
  'Criar um funil de orçamentos com 4 etapas',
  'Adicionar um campo de “Data de retorno” nos cards',
  'Cadastrar um lead novo no funil de vendas',
];

/**
 * Assistente do CRM: chat com o agente CRM (configura e opera o CRM na hora).
 * Quando o agente termina uma resposta, dispara onChanged para o board/contatos
 * recarregarem — o agente pode ter criado funis, campos ou cards.
 */
export function CrmAssistant({ onChanged }: { onChanged?: () => void }) {
  const transport = React.useMemo(
    () => new DefaultChatTransport({ api: '/api/crm/agent' }),
    [],
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const sendIconRef = React.useRef<SendIconHandle | null>(null);

  const ocupado = status === 'submitted' || status === 'streaming';

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status]);

  // Ao concluir uma resposta, o CRM pode ter mudado → recarrega o board.
  const statusAnterior = React.useRef(status);
  React.useEffect(() => {
    if (statusAnterior.current !== 'ready' && status === 'ready') onChanged?.();
    statusAnterior.current = status;
  }, [status, onChanged]);

  async function enviar(texto?: string) {
    const t = (texto ?? input).trim();
    if (!t || ocupado) return;
    setInput('');
    sendIconRef.current?.startAnimation();
    window.setTimeout(() => sendIconRef.current?.stopAnimation(), 800);
    await sendMessage({ text: t });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" aria-hidden />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              Peça para o assistente organizar seu CRM
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Ele cria e ajusta funis, etapas e campos, e cadastra ou move negócios — é
              só descrever o que precisa.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => void enviar(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageParts key={m.id} message={m} />)
        )}
        {status === 'submitted' ? (
          <p className="px-2 text-xs text-muted-foreground">Trabalhando…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={2}
          placeholder="Ex.: crie um funil de pós-venda com 3 etapas…"
          className="max-h-40 min-h-11 flex-1 resize-none"
          aria-label="Mensagem para o assistente de CRM"
        />
        <Button
          size="icon-lg"
          onClick={() => void enviar()}
          disabled={ocupado || !input.trim()}
          aria-label="Enviar"
        >
          <SendIcon ref={sendIconRef} size={16} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
