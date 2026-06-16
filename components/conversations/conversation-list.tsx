'use client';

import * as React from 'react';
import { Check, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Conversa {
  id: string;
  titulo: string | null;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: number;
}

export interface ConversationListProps {
  conversas: Conversa[];
  activeId: string | null;
  carregando: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, titulo: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversas,
  activeId,
  carregando,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: ConversationListProps) {
  const [editando, setEditando] = React.useState<string | null>(null);
  const [rascunho, setRascunho] = React.useState('');

  function iniciarEdicao(c: Conversa) {
    setEditando(c.id);
    setRascunho(c.titulo ?? '');
  }

  function confirmarEdicao(id: string) {
    const t = rascunho.trim();
    if (t) onRename(id, t);
    setEditando(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={onNew}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        Nova conversa
      </Button>

      <ScrollArea className="min-h-0 flex-1">
        {carregando && conversas.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Carregando conversas…
          </p>
        ) : conversas.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nenhuma conversa ainda. Comece uma nova.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 pr-1">
            {conversas.map((c) => {
              const ativo = c.id === activeId;
              const emEdicao = editando === c.id;
              return (
                <li key={c.id}>
                  {emEdicao ? (
                    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
                      <input
                        autoFocus
                        value={rascunho}
                        onChange={(e) => setRascunho(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmarEdicao(c.id);
                          if (e.key === 'Escape') setEditando(null);
                        }}
                        className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-xs outline-none"
                        aria-label="Novo título da conversa"
                      />
                      <button
                        type="button"
                        onClick={() => confirmarEdicao(c.id)}
                        className="shrink-0 rounded-md p-1 text-emerald-600 hover:bg-muted"
                        aria-label="Salvar título"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Cancelar"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors',
                        ativo
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                      >
                        <span
                          className={cn(
                            'w-full truncate text-xs font-medium',
                            ativo ? 'text-foreground' : 'text-foreground/90',
                          )}
                        >
                          {c.titulo ?? 'Nova conversa'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatarData(c.atualizadoEm)}
                          {c.mensagens > 0 ? ` · ${c.mensagens} msg` : ''}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 has-focus-visible:opacity-100">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(c)}
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Renomear conversa"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(c.id)}
                          className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Apagar conversa"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
