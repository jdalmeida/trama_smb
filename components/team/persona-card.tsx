'use client';

import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import type { PersonaConfig } from '@/src/agents/registry';
import type { PersonaId, PersonaStatus } from '@/src/domain/persona';
import { cn } from '@/lib/utils';
import { PERSONA_THEME } from '@/components/team/persona-theme';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoaderIcon, type LoaderIconHandle } from '@/components/ui/loader';
import {
  CircleCheckIcon,
  type CircleCheckIconHandle,
} from '@/components/ui/circle-check';
import { ZapIcon } from '@/components/ui/zap';
import { SearchIcon } from '@/components/ui/search';
import { UsersIcon } from '@/components/ui/users';

const STATUS_LABEL: Record<PersonaStatus, string> = {
  idle: 'Parado',
  working: 'Trabalhando',
  done: 'Concluído',
  error: 'Erro',
};

/** Classes extras do Badge por status (cores sem variant dedicada). */
const STATUS_BADGE_CLASS: Record<PersonaStatus, string> = {
  idle: 'border-border bg-transparent text-muted-foreground',
  working: 'bg-primary/10 text-primary',
  done: 'bg-emerald-500/15 text-emerald-700',
  error: '',
};

/** Handle comum dos ícones animados (lucide-animated). */
interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

type AnimatedIcon = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnimatedIconHandle>
>;

/** Ícone animado de cada persona (anima no hover do card). */
const PERSONA_ICON: Record<PersonaId, AnimatedIcon> = {
  'conteudo-aquisicao': ZapIcon,
  'pesquisa-mercado': SearchIcon,
  'vendas-prospeccao': UsersIcon,
};

function StatusBadge({ status }: { status: PersonaStatus }) {
  const loaderRef = React.useRef<LoaderIconHandle>(null);
  const checkRef = React.useRef<CircleCheckIconHandle>(null);

  // Loader gira continuamente enquanto status=working; o check "desenha"
  // o traço na transição para done.
  React.useEffect(() => {
    if (status === 'working') loaderRef.current?.startAnimation();
    else if (status === 'done') checkRef.current?.startAnimation();
  }, [status]);

  return (
    <Badge
      key={status}
      variant={status === 'error' ? 'destructive' : 'secondary'}
      className={cn(
        'shrink-0 animate-in fade-in zoom-in-90 duration-300',
        STATUS_BADGE_CLASS[status],
      )}
    >
      {status === 'working' ? (
        <LoaderIcon ref={loaderRef} size={12} className="flex" aria-hidden />
      ) : null}
      {status === 'done' ? (
        <CircleCheckIcon ref={checkRef} size={12} className="flex" aria-hidden />
      ) : null}
      {status === 'error' ? (
        <CircleAlert className="size-3" aria-hidden />
      ) : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

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
  const iconRef = React.useRef<AnimatedIconHandle>(null);
  const Icon = PERSONA_ICON[persona.id];
  const tema = PERSONA_THEME[persona.id];

  return (
    <Card
      size="sm"
      className={cn(
        'transition-all duration-300',
        status === 'working' && 'ring-primary/30',
        status === 'error' && 'ring-destructive/30',
      )}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            tema.iconChip,
          )}
          aria-hidden
        >
          <Icon ref={iconRef} size={20} className="flex" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {persona.nome}
            </h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {persona.descricao}
          </p>
          {atividade ? (
            <p
              key={atividade}
              className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {atividade}
            </p>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
