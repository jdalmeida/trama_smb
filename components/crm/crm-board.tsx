'use client';

import * as React from 'react';
import { Plus, Settings2, GripVertical } from 'lucide-react';
import type { BoardDTO, CardDTO, ContactDTO, FieldDTO } from '@/src/domain/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { CardEditor } from '@/components/crm/card-editor';
import { formatarValorCampo, somarCurrency } from '@/components/crm/field-input';

/**
 * Quadro kanban de um funil. Colunas = pontos do funil; cards arrastáveis entre
 * elas (drag-drop nativo do HTML5, sem libs). Move otimista + persistência via
 * POST /api/crm/cards/[id]/move. Clicar num card abre o editor data-driven.
 */
export function CrmBoard({
  board,
  contatos,
  onRefresh,
  onConfigurar,
}: {
  board: BoardDTO;
  contatos: ContactDTO[];
  onRefresh: () => void;
  onConfigurar: () => void;
}) {
  const [cards, setCards] = React.useState<CardDTO[]>(board.cards);
  React.useEffect(() => setCards(board.cards), [board]);

  const arrastando = React.useRef<string | null>(null);
  const [editor, setEditor] = React.useState<
    { card: CardDTO | null; stageId?: string } | null
  >(null);

  const contatosPorId = React.useMemo(
    () => new Map(contatos.map((c) => [c.id, c])),
    [contatos],
  );

  const stagesOrdenados = React.useMemo(
    () => [...board.stages].sort((a, b) => a.ordem - b.ordem),
    [board.stages],
  );

  // Campo currency principal (1º): mostrado em destaque e somado por coluna.
  const campoValor = React.useMemo(
    () => board.fields.find((f) => f.tipo === 'currency') ?? null,
    [board.fields],
  );

  function cardsDoStage(stageId: string): CardDTO[] {
    return cards
      .filter((c) => c.stageId === stageId)
      .sort((a, b) => a.ordem - b.ordem);
  }

  async function soltarNoStage(stageId: string, antesDoCardId?: string) {
    const cardId = arrastando.current;
    arrastando.current = null;
    if (!cardId) return;

    const movido = cards.find((c) => c.id === cardId);
    if (!movido) return;
    if (movido.stageId === stageId && !antesDoCardId) {
      // Soltou na mesma coluna sem alvo específico → nada a fazer.
      return;
    }

    // Recalcula a coluna destino com o card inserido na posição.
    const destino = cardsDoStage(stageId).filter((c) => c.id !== cardId);
    const idx = antesDoCardId
      ? destino.findIndex((c) => c.id === antesDoCardId)
      : destino.length;
    const pos = idx < 0 ? destino.length : idx;
    destino.splice(pos, 0, { ...movido, stageId });
    const orderedIds = destino.map((c) => c.id);

    // Otimista: reflete já no estado local.
    setCards((prev) => {
      const semMovido = prev.filter((c) => c.id !== cardId);
      const reordenados = orderedIds.map((id, i) => {
        const base =
          id === cardId ? { ...movido, stageId } : semMovido.find((c) => c.id === id)!;
        return { ...base, ordem: i };
      });
      const fora = semMovido.filter((c) => !orderedIds.includes(c.id));
      return [...fora, ...reordenados];
    });

    try {
      const res = await fetch(`/api/crm/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, orderedIds }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast({ title: 'Não foi possível mover o card' });
      onRefresh();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">
            {board.pipeline.nome}
          </h2>
          {board.pipeline.descricao ? (
            <p className="truncate text-xs text-muted-foreground">
              {board.pipeline.descricao}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onConfigurar}>
          <Settings2 className="size-3.5" aria-hidden />
          Configurar
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {stagesOrdenados.map((stage) => {
          const lista = cardsDoStage(stage.id);
          const soma = campoValor
            ? somarCurrency(campoValor, lista.map((c) => c.valores))
            : 0;
          return (
            <div
              key={stage.id}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void soltarNoStage(stage.id)}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.cor }}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {stage.nome}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {lista.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setEditor({ card: null, stageId: stage.id })}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`Novo card em ${stage.nome}`}
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {campoValor && soma > 0 ? (
                <div className="px-3 pt-2 text-[11px] font-medium text-muted-foreground">
                  {soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              ) : null}

              <div className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {lista.map((card) => (
                  <KanbanCard
                    key={card.id}
                    card={card}
                    fields={board.fields}
                    contatoNome={
                      card.contatoId
                        ? contatosPorId.get(card.contatoId)?.nome ?? null
                        : null
                    }
                    onDragStart={() => (arrastando.current = card.id)}
                    onDropAntes={() => void soltarNoStage(stage.id, card.id)}
                    onClick={() => setEditor({ card, stageId: stage.id })}
                  />
                ))}
                {lista.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditor({ card: null, stageId: stage.id })}
                    className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Adicionar card
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {editor ? (
        <CardEditor
          pipelineId={board.pipeline.id}
          stageInicial={editor.stageId}
          stages={stagesOrdenados}
          fields={board.fields}
          contatos={contatos}
          card={editor.card}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Cartão arrastável do kanban: título, contato e chips dos campos preenchidos. */
function KanbanCard({
  card,
  fields,
  contatoNome,
  onDragStart,
  onDropAntes,
  onClick,
}: {
  card: CardDTO;
  fields: FieldDTO[];
  contatoNome: string | null;
  onDragStart: () => void;
  onDropAntes: () => void;
  onClick: () => void;
}) {
  // Até 3 campos com valor para exibir como chips (currency primeiro).
  const chips = React.useMemo(() => {
    const comValor = fields
      .filter((f) => {
        const v = card.valores[f.chave];
        return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
      })
      .sort((a, b) => (a.tipo === 'currency' ? -1 : 0) - (b.tipo === 'currency' ? -1 : 0));
    return comValor.slice(0, 3).map((f) => ({
      chave: f.chave,
      tipo: f.tipo,
      texto: formatarValorCampo(f, card.valores[f.chave]),
    }));
  }, [card.valores, fields]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDropAntes();
      }}
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border bg-background p-2.5 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-foreground">{card.titulo}</p>
          {contatoNome ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{contatoNome}</p>
          ) : null}
          {chips.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((c) => (
                <Badge
                  key={c.chave}
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    c.tipo === 'currency' &&
                      'border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
                  )}
                >
                  {c.texto}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
