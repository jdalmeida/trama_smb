'use client';

import * as React from 'react';
import { PERSONA_LIST } from '@/src/agents/registry';
import type { PersonaConfig } from '@/src/agents/registry';
import type {
  PersonaId,
  PersonaStatus,
  PersonaStatusEvent,
} from '@/src/domain/persona';
import type { DeliverableContent } from '@/src/domain/deliverable';
import { PersonaCard } from '@/components/team/persona-card';
import { DeliverableView } from '@/components/deliverable/deliverable-view';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UsersIcon, type UsersIconHandle } from '@/components/ui/users';
import { cn } from '@/lib/utils';

/** Um run delegado, derivado das mensagens do chat. */
export interface ActiveRun {
  runId: string;
  personaId: PersonaId;
  deliverableId: string;
}

interface RunState {
  status: PersonaStatus;
  atividade?: string;
  deliverableId?: string;
}

interface DeliverableData {
  id: string;
  titulo: string;
  status: string;
  content: DeliverableContent | null;
}

export interface TeamPanelProps {
  runs: ActiveRun[];
}

export function TeamPanel({ runs }: TeamPanelProps) {
  // Estado por personaId (a UI mostra um card por persona de PERSONA_LIST).
  const [byPersona, setByPersona] = React.useState<
    Record<string, RunState | undefined>
  >({});
  // Entregáveis carregados (por deliverableId) e qual está aberto.
  const [deliverables, setDeliverables] = React.useState<
    Record<string, DeliverableData | undefined>
  >({});
  const [aberto, setAberto] = React.useState<string | null>(null);

  const setPersonaState = React.useCallback(
    (personaId: PersonaId, patch: Partial<RunState>) => {
      setByPersona((prev) => {
        const atual = prev[personaId] ?? { status: 'working' as PersonaStatus };
        return { ...prev, [personaId]: { ...atual, ...patch } };
      });
    },
    [],
  );

  const carregarEntregavel = React.useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { deliverable?: DeliverableData } & DeliverableData;
      const d = (data.deliverable ?? data) as DeliverableData | undefined;
      if (d && d.id) {
        setDeliverables((prev) => ({ ...prev, [d.id]: d }));
      }
    } catch {
      // silencioso — o card continua exibindo "concluído"
    }
  }, []);

  // Para cada run ativo, abre o stream NDJSON e atualiza o card.
  React.useEffect(() => {
    const controllers: AbortController[] = [];

    for (const run of runs) {
      const controller = new AbortController();
      controllers.push(controller);

      // marca como trabalhando assim que o run aparece
      setPersonaState(run.personaId, {
        status: 'working',
        deliverableId: run.deliverableId,
      });

      (async () => {
        try {
          const res = await fetch(`/api/runs/${run.runId}/stream?ns=status`, {
            signal: controller.signal,
          });
          if (!res.ok || !res.body) return;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl = buffer.indexOf('\n');
            while (nl !== -1) {
              const linha = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (linha) aplicarEvento(linha, run);
              nl = buffer.indexOf('\n');
            }
          }
          // resto do buffer
          const resto = buffer.trim();
          if (resto) aplicarEvento(resto, run);
        } catch {
          // abortado ou erro de rede — ignora
        }
      })();
    }

    function aplicarEvento(linha: string, run: ActiveRun) {
      let ev: PersonaStatusEvent;
      try {
        ev = JSON.parse(linha) as PersonaStatusEvent;
      } catch {
        return;
      }
      if (ev.kind === 'status') {
        setPersonaState(ev.personaId, {
          status: ev.status,
          atividade: ev.mensagem,
        });
        if (ev.status === 'done') void carregarEntregavel(run.runId);
      } else if (ev.kind === 'atividade') {
        setPersonaState(ev.personaId, { atividade: ev.texto });
      } else if (ev.kind === 'entregavel') {
        setPersonaState(ev.personaId, {
          status: 'done',
          deliverableId: ev.deliverableId,
        });
        void carregarEntregavel(run.runId);
      }
    }

    return () => {
      for (const c of controllers) c.abort();
    };
    // re-conecta quando a lista de runIds muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.map((r) => r.runId).join(',')]);

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Time</h2>
        <span className="text-xs text-muted-foreground">
          {PERSONA_LIST.length} agentes
        </span>
      </div>

      {runs.length === 0 ? <EstadoVazio /> : null}

      {PERSONA_LIST.map((persona: PersonaConfig, i) => {
        const estado = byPersona[persona.id];
        const status: PersonaStatus = estado?.status ?? 'idle';
        const deliverableId = estado?.deliverableId;
        const deliverable = deliverableId
          ? deliverables[deliverableId]
          : undefined;
        const isAberto = aberto === deliverableId;

        return (
          <div
            key={persona.id}
            className="fill-mode-backwards animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <PersonaCard
              persona={persona}
              status={status}
              atividade={estado?.atividade}
            >
              {status === 'done' && deliverableId ? (
                <div className="flex flex-col">
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    aria-expanded={isAberto}
                    onClick={() =>
                      setAberto((cur) =>
                        cur === deliverableId ? null : deliverableId,
                      )
                    }
                  >
                    {isAberto ? 'Ocultar entregável' : 'Ver entregável'}
                  </Button>
                  <div
                    className={cn(
                      'grid transition-all duration-300 ease-out',
                      isAberto
                        ? 'mt-2 grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <DeliverableSummary deliverable={deliverable} />
                    </div>
                  </div>
                </div>
              ) : null}
            </PersonaCard>
          </div>
        );
      })}
    </aside>
  );
}

/** Estado vazio do painel: nenhum run delegado ainda. */
function EstadoVazio() {
  const iconRef = React.useRef<UsersIconHandle>(null);

  React.useEffect(() => {
    const t = setTimeout(() => iconRef.current?.startAnimation(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center animate-in fade-in zoom-in-95 duration-500"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <UsersIcon ref={iconRef} size={24} className="flex" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Seu time está pronto
        </p>
        <p className="text-xs text-muted-foreground">
          Delegue uma tarefa no chat para ver o time trabalhando.
        </p>
      </div>
    </div>
  );
}

function DeliverableSummary({
  deliverable,
}: {
  deliverable: DeliverableData | undefined;
}) {
  // Alterna entre o resumo curto e a visão completa do entregável.
  const [completo, setCompleto] = React.useState(false);

  if (!deliverable) {
    return (
      <p className="text-xs text-muted-foreground">Carregando entregável…</p>
    );
  }

  const content = deliverable.content;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
      <p className="font-semibold text-foreground">{deliverable.titulo}</p>
      {!content ? (
        <p className="text-muted-foreground">Sem conteúdo ainda.</p>
      ) : completo ? (
        <ScrollArea className="h-80 rounded-md">
          <div className="pr-3 animate-in fade-in duration-300">
            <DeliverableView content={content} />
          </div>
        </ScrollArea>
      ) : (
        <div className="animate-in fade-in duration-300">
          <ResumoCurto content={content} />
        </div>
      )}
      {content ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setCompleto((v) => !v)}
        >
          {completo ? 'Ver só o resumo' : 'Ver entregável completo'}
        </Button>
      ) : null}
    </div>
  );
}

/** Resumo curto por tipo de entregável (a visão rica fica em DeliverableView). */
function ResumoCurto({ content }: { content: DeliverableContent }) {
  if (content.tipo === 'plano-conteudo') {
    return (
      <div className="flex flex-col gap-2 text-foreground">
        <p>{content.resumo}</p>
        {content.canais?.length ? (
          <div>
            <p className="font-medium">Canais</p>
            <ul className="ml-4 list-disc">
              {content.canais.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.canal}</span> —{' '}
                  {c.frequencia}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.ideiasProntas?.length ? (
          <p className="text-muted-foreground">
            {content.ideiasProntas.length} ideias prontas no plano completo.
          </p>
        ) : null}
      </div>
    );
  }

  if (content.tipo === 'pesquisa-mercado') {
    return (
      <div className="flex flex-col gap-2 text-foreground">
        <p>{content.panorama}</p>
        {content.concorrentes?.length ? (
          <div>
            <p className="font-medium">Concorrentes</p>
            <ul className="ml-4 list-disc">
              {content.concorrentes.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.nome}</span> — {c.oQueFazem}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (content.tipo === 'plano-prospeccao') {
    return (
      <div className="flex flex-col gap-2 text-foreground">
        <p>{content.resumo}</p>
        {content.oportunidades?.length ? (
          <div>
            <p className="font-medium">Oportunidades</p>
            <ul className="ml-4 list-disc">
              {content.oportunidades.map((o, i) => (
                <li key={i}>
                  <span className="font-medium">{o.nome}</span> — {o.tipo}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.roteirosAbordagem?.length ? (
          <p className="text-muted-foreground">
            {content.roteirosAbordagem.length} roteiros de abordagem no plano
            completo.
          </p>
        ) : null}
      </div>
    );
  }

  if (content.tipo === 'texto') {
    return <p className="whitespace-pre-wrap text-foreground">{content.texto}</p>;
  }

  return <p className="text-muted-foreground">Veja o entregável completo.</p>;
}
