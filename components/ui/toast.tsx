'use client';

import * as React from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toast mínimo e sem dependência externa: um pub/sub a nível de módulo + um
 * <Toaster /> montado uma vez. Chame `toast({ title, description })` de
 * qualquer lugar (ex.: quando um entregável fica pronto).
 */

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'success';
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit() {
  for (const l of listeners) l(toasts);
}

export function toast(input: Omit<ToastItem, 'id'>) {
  const id = ++seq;
  toasts = [...toasts, { id, variant: 'default', ...input }];
  emit();
  // auto-dismiss
  setTimeout(() => dismiss(id), 6000);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>(toasts);

  React.useEffect(() => {
    const listener: Listener = (next) => setItems([...next]);
    listeners.add(listener);
    setItems([...toasts]);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-300',
            t.variant === 'success' && 'border-emerald-500/40',
          )}
        >
          <span
            className={cn(
              'mt-0.5 shrink-0',
              t.variant === 'success' ? 'text-emerald-600' : 'text-primary',
            )}
            aria-hidden
          >
            {t.variant === 'success' ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Info className="size-5" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold text-foreground">{t.title}</p>
            {t.description ? (
              <p className="text-xs text-muted-foreground">{t.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
