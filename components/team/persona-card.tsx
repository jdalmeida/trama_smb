'use client';

import * as React from 'react';
import type { PersonaConfig } from '@/src/agents/registry';
import type { PersonaStatus } from '@/src/domain/persona';
import { Card } from '@/components/ui/card';

const STATUS_LABEL: Record<PersonaStatus, string> = {
  idle: 'Parado',
  working: 'Trabalhando',
  done: 'Concluído',
  error: 'Erro',
};

const STATUS_STYLE: Record<PersonaStatus, string> = {
  idle: 'bg-stone-100 text-stone-600',
  working: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
};

export interface PersonaCardProps {
  persona: PersonaConfig;
  status: PersonaStatus;
  atividade?: string;
  /** Conteúdo extra renderizado no rodapé (ex.: botão "Ver entregável"). */
  children?: React.ReactNode;
}

export function PersonaCard({
  persona,
  status,
  atividade,
  children,
}: PersonaCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-xl"
          aria-hidden
        >
          {persona.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--color-ink)]">
              {persona.nome}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
            >
              {status === 'working' && (
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />
              )}
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-[var(--color-muted)]">
            {persona.descricao}
          </p>
          {atividade ? (
            <p className="mt-2 rounded-md bg-stone-50 px-2 py-1.5 text-xs text-stone-600">
              {atividade}
            </p>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}
