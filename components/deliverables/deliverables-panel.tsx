'use client';

import * as React from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import type { PersonaId, PersonaStatus } from '@/src/domain/persona';
import type { DeliverableContent } from '@/src/domain/deliverable';
import { PERSONAS } from '@/src/agents/registry';
import { PERSONA_THEME } from '@/components/team/persona-theme';
import { DeliverableView } from '@/components/deliverable/deliverable-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface EntregavelResumo {
  id: string;
  titulo: string;
  personaId: PersonaId;
  status: PersonaStatus;
  criadoEm: string;
}

interface EntregavelCompleto extends EntregavelResumo {
  content: DeliverableContent | null;
}

const STATUS: Record<
  PersonaStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  idle: {
    label: 'Aguardando',
    className: 'text-muted-foreground',
    Icon: FileText,
  },
  working: {
    label: 'Trabalhando',
    className: 'text-primary',
    Icon: Loader2,
  },
  done: {
    label: 'Concluído',
    className: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    label: 'Erro',
    className: 'text-destructive',
    Icon: TriangleAlert,
  },
};

/**
 * Painel "Entregáveis": lista tudo que o time produziu, com status visível, e
 * abre o conteúdo completo inline. Dispara um toast quando um entregável fica
 * pronto — é como o resultado aparece "na cara" do usuário (problema #4).
 */
export function DeliverablesPanel() {
  const { entregaveis, carregando, refresh } = useEntregaveis();
  const [aberto, setAberto] = React.useState<string | null>(null);

  const prontos = entregaveis.filter((e) => e.status === 'done').length;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-foreground">Entregáveis</h2>
          <p className="text-xs text-muted-foreground">
            Tudo que o seu time já produziu.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {entregaveis.length === 0
            ? 'nenhum ainda'
            : `${prontos}/${entregaveis.length} prontos`}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {carregando && entregaveis.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">Carregando…</p>
        ) : entregaveis.length === 0 ? (
          <EstadoVazio />
        ) : (
          <ul className="flex flex-col gap-2 pr-1">
            {entregaveis.map((e) => (
              <EntregavelItem
                key={e.id}
                entregavel={e}
                aberto={aberto === e.id}
                onToggle={() =>
                  setAberto((cur) => (cur === e.id ? null : e.id))
                }
                onRetomado={() => void refresh()}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

function EntregavelItem({
  entregavel,
  aberto,
  onToggle,
  onRetomado,
}: {
  entregavel: EntregavelResumo;
  aberto: boolean;
  onToggle: () => void;
  onRetomado: () => void;
}) {
  const [completo, setCompleto] = React.useState<EntregavelCompleto | null>(
    null,
  );
  const [retomando, setRetomando] = React.useState(false);
  const persona = PERSONAS[entregavel.personaId];
  const cfg = STATUS[entregavel.status] ?? STATUS.idle;
  const podeAbrir = entregavel.status === 'done';

  async function retomar() {
    setRetomando(true);
    try {
      const res = await fetch(`/api/deliverables/${entregavel.id}/resume`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        jaConcluido?: boolean;
        erro?: string;
      };
      if (res.ok && data.ok) {
        toast({
          variant: 'success',
          title: data.jaConcluido ? 'Já estava concluído' : 'Retomando a tarefa…',
          description: persona ? persona.nome : entregavel.personaId,
        });
        onRetomado();
      } else {
        toast({
          title: 'Não foi possível retomar',
          description: data.erro,
        });
      }
    } catch {
      toast({ title: 'Não foi possível retomar' });
    } finally {
      setRetomando(false);
    }
  }

  React.useEffect(() => {
    if (!aberto || completo) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/deliverables/${entregavel.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as { entregavel: EntregavelCompleto };
        if (vivo) setCompleto(data.entregavel);
      } catch {
        // silencioso
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, completo, entregavel.id]);

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex items-start gap-2 p-2.5">
        <span
          className={cn('mt-0.5 shrink-0', cfg.className)}
          aria-hidden
          title={cfg.label}
        >
          <cfg.Icon
            className={cn('size-4', entregavel.status === 'working' && 'animate-spin')}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="break-words text-sm font-semibold text-foreground">
            {entregavel.titulo}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  PERSONA_THEME[entregavel.personaId].dot,
                )}
                aria-hidden
              />
              {persona ? `${persona.emoji} ${persona.nome}` : entregavel.personaId}
            </span>
            <span aria-hidden>·</span>
            <Badge
              variant="secondary"
              className={cn('px-1.5 py-0 text-[10px]', cfg.className)}
            >
              {cfg.label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {podeAbrir ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                aria-expanded={aberto}
                onClick={onToggle}
              >
                {aberto ? 'Ocultar' : 'Ver entregável'}
              </Button>
            ) : null}

            {entregavel.status === 'error' ? (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => void retomar()}
                disabled={retomando}
              >
                <RefreshCw
                  className={cn('size-3.5', retomando && 'animate-spin')}
                  aria-hidden
                />
                {retomando ? 'Retomando…' : 'Retomar'}
              </Button>
            ) : null}

            {entregavel.status === 'working' ? (
              <button
                type="button"
                onClick={() => void retomar()}
                disabled={retomando}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {retomando ? 'Verificando…' : 'Travou? Retomar'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {aberto && podeAbrir ? (
        <div className="border-t p-3 animate-in fade-in duration-300">
          {completo?.content ? (
            <DeliverableView content={completo.content} />
          ) : (
            <p className="text-xs text-muted-foreground">Carregando conteúdo…</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Busca os entregáveis (montagem + poll a cada 6s) e dispara um toast de
 * "novo entregável pronto" quando um deles transita para done.
 */
function useEntregaveis(): {
  entregaveis: EntregavelResumo[];
  carregando: boolean;
  refresh: () => Promise<void>;
} {
  const [entregaveis, setEntregaveis] = React.useState<EntregavelResumo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  // status conhecido por id — para detectar a transição → done.
  const statusRef = React.useRef<Map<string, PersonaStatus>>(new Map());
  const primeiraCarga = React.useRef(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/deliverables');
      if (!res.ok) return;
      const data = (await res.json()) as { entregaveis?: EntregavelResumo[] };
      const lista = data.entregaveis ?? [];

      // Detecta entregáveis recém-concluídos (exceto na 1ª carga).
      if (!primeiraCarga.current) {
        for (const e of lista) {
          const anterior = statusRef.current.get(e.id);
          if (e.status === 'done' && anterior && anterior !== 'done') {
            const persona = PERSONAS[e.personaId];
            toast({
              variant: 'success',
              title: '🎉 Novo entregável pronto!',
              description: `${persona ? persona.nome : e.personaId}: ${e.titulo}`,
            });
          }
        }
      }
      for (const e of lista) statusRef.current.set(e.id, e.status);
      primeiraCarga.current = false;

      setEntregaveis(lista);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
  }, [refresh]);

  return { entregaveis, carregando, refresh };
}

function EstadoVazio() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <FileText className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Nenhum entregável ainda
        </p>
        <p className="text-xs text-muted-foreground">
          Quando o time concluir uma tarefa, o resultado aparece aqui — e você
          recebe um aviso.
        </p>
      </div>
    </div>
  );
}
