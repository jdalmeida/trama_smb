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
import { Button } from '@/components/ui/button';

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

interface DeliverableView {
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
    Record<string, DeliverableView | undefined>
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
      const data = (await res.json()) as { deliverable?: DeliverableView } & DeliverableView;
      const d = (data.deliverable ?? data) as DeliverableView | undefined;
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
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Time</h2>
        <span className="text-xs text-[var(--color-muted)]">
          {PERSONA_LIST.length} agentes
        </span>
      </div>

      {PERSONA_LIST.map((persona: PersonaConfig) => {
        const estado = byPersona[persona.id];
        const status: PersonaStatus = estado?.status ?? 'idle';
        const deliverableId = estado?.deliverableId;
        const deliverable = deliverableId
          ? deliverables[deliverableId]
          : undefined;

        return (
          <PersonaCard
            key={persona.id}
            persona={persona}
            status={status}
            atividade={estado?.atividade}
          >
            {status === 'done' && deliverableId ? (
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setAberto((cur) =>
                      cur === deliverableId ? null : deliverableId,
                    )
                  }
                >
                  {aberto === deliverableId
                    ? 'Ocultar entregável'
                    : 'Ver entregável'}
                </Button>
                {aberto === deliverableId ? (
                  <DeliverableSummary deliverable={deliverable} />
                ) : null}
              </div>
            ) : null}
          </PersonaCard>
        );
      })}
    </aside>
  );
}

function DeliverableSummary({
  deliverable,
}: {
  deliverable: DeliverableView | undefined;
}) {
  if (!deliverable) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        Carregando entregável…
      </p>
    );
  }

  const content = deliverable.content;

  return (
    <div className="space-y-2 rounded-lg border border-black/5 bg-stone-50 p-3 text-xs">
      <p className="font-semibold text-[var(--color-ink)]">
        {deliverable.titulo}
      </p>
      {!content ? (
        <p className="text-[var(--color-muted)]">Sem conteúdo ainda.</p>
      ) : content.tipo === 'plano-conteudo' ? (
        <div className="space-y-2 text-stone-700">
          <p>{content.resumo}</p>
          {content.canais?.length ? (
            <div>
              <p className="font-medium text-[var(--color-ink)]">Canais</p>
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
            <p className="text-[var(--color-muted)]">
              {content.ideiasProntas.length} ideias prontas no plano completo.
            </p>
          ) : null}
        </div>
      ) : content.tipo === 'pesquisa-mercado' ? (
        <div className="space-y-2 text-stone-700">
          <p>{content.panorama}</p>
          {content.concorrentes?.length ? (
            <div>
              <p className="font-medium text-[var(--color-ink)]">
                Concorrentes
              </p>
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
      ) : (
        <p className="whitespace-pre-wrap text-stone-700">{content.texto}</p>
      )}
    </div>
  );
}
