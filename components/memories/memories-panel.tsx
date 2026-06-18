'use client';

import * as React from 'react';
import { Brain, CheckCircle2, Clock } from 'lucide-react';
import type { BusinessProfile } from '@/src/domain/business-profile';
import { ProfileFields } from '@/components/profile/profile-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface MemoriesPanelProps {
  profile: BusinessProfile | null;
  verified: boolean | null;
  carregando: boolean;
  /** Confirma o perfil (marca como verificado). */
  onConfirmar: (profile: BusinessProfile) => Promise<void> | void;
}

/**
 * Aba "Memórias": o Perfil do Negócio que o CEO montou na conversa. Antes ele
 * ficava repetindo no chat mesmo depois de confirmado; agora vive aqui, em
 * página dedicada, e o chat só mostra o card enquanto falta confirmar.
 */
export function MemoriesPanel({
  profile,
  verified,
  carregando,
  onConfirmar,
}: MemoriesPanelProps) {
  const [confirmando, setConfirmando] = React.useState(false);

  async function confirmar() {
    if (!profile) return;
    setConfirmando(true);
    try {
      await onConfirmar(profile);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-foreground">
            Perfil do negócio
          </h2>
          <p className="text-xs text-muted-foreground">
            Quem é o seu negócio — a base de contexto que todo o time usa.
          </p>
        </div>
        {profile ? <StatusBadge verified={verified} /> : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {carregando && !profile ? (
          <p className="px-1 text-xs text-muted-foreground">Carregando perfil…</p>
        ) : !profile ? (
          <EstadoVazio />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Brain className="size-4" />
                </span>
                Perfil do Negócio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProfileFields profile={profile} />

              {verified === false ? (
                <div className="flex items-center gap-3 border-t pt-3">
                  <Button
                    onClick={() => void confirmar()}
                    disabled={confirmando}
                  >
                    {confirmando ? 'Confirmando…' : 'Confirmar perfil'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Revise os dados e confirme para o time usar.
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </ScrollArea>
    </aside>
  );
}

function StatusBadge({ verified }: { verified: boolean | null }) {
  if (verified) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="size-3.5" aria-hidden />
        Confirmado
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300')}
    >
      <Clock className="size-3.5" aria-hidden />
      Aguardando confirmação
    </Badge>
  );
}

function EstadoVazio() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <Brain className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Ainda não há perfil
        </p>
        <p className="text-xs text-muted-foreground">
          Converse com o CEO sobre o seu negócio: o que você vende, para quem e
          onde atua. Ele monta o perfil e ele aparece aqui.
        </p>
      </div>
    </div>
  );
}
