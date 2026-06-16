'use client';

import * as React from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import type { BoardDTO, ContactDTO } from '@/src/domain/crm';
import {
  CRM_ACTIVITY_EMOJI,
  CRM_ACTIVITY_LABELS,
  CRM_ACTIVITY_TIPOS,
  type ActivityDTO,
  type CrmActivityTipo,
} from '@/src/domain/crm-activity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/crm/modal';

const selectCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Rótulo amigável de um dia (Hoje / Amanhã / data). */
function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  if (chaveDia(d) === chaveDia(hoje)) return 'Hoje';
  if (chaveDia(d) === chaveDia(amanha)) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Agenda do CRM (Leva 3): tarefas, follow-ups, ligações e reuniões. Visões em
 * Lista (agrupada por dia) e Mês (calendário). Atividades podem ser ligadas a
 * cards/contatos e criadas à mão ou por automações.
 */
export function CrmAgenda({
  board,
  contatos,
  onRefresh,
}: {
  board: BoardDTO;
  contatos: ContactDTO[];
  onRefresh: () => void;
}) {
  const [atividades, setAtividades] = React.useState<ActivityDTO[]>([]);
  const [view, setView] = React.useState<'lista' | 'mes'>('lista');
  const [soPendentes, setSoPendentes] = React.useState(true);
  const [editor, setEditor] = React.useState<ActivityDTO | null | undefined>(undefined);

  const carregar = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crm/activities?status=${soPendentes ? 'pendente' : 'todas'}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { atividades?: ActivityDTO[] };
      setAtividades(data.atividades ?? []);
    } catch {
      // silencioso
    }
  }, [soPendentes]);

  React.useEffect(() => {
    void carregar();
  }, [carregar]);

  async function concluir(a: ActivityDTO, valor: boolean) {
    setAtividades((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, concluida: valor } : x)),
    );
    await fetch(`/api/crm/activities/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concluida: valor }),
    });
    void carregar();
  }

  async function apagar(a: ActivityDTO) {
    if (!confirm(`Apagar “${a.titulo}”?`)) return;
    await fetch(`/api/crm/activities/${a.id}`, { method: 'DELETE' });
    void carregar();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          <TabBtn ativo={view === 'lista'} onClick={() => setView('lista')}>
            <List className="size-3.5" aria-hidden />
            Lista
          </TabBtn>
          <TabBtn ativo={view === 'mes'} onClick={() => setView('mes')}>
            <CalendarDays className="size-3.5" aria-hidden />
            Mês
          </TabBtn>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={soPendentes}
              onChange={(e) => setSoPendentes(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Só pendentes
          </label>
          <Button size="sm" className="gap-1.5" onClick={() => setEditor(null)}>
            <Plus className="size-3.5" aria-hidden />
            Nova atividade
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'lista' ? (
          <AgendaLista
            atividades={atividades}
            onConcluir={concluir}
            onEditar={(a) => setEditor(a)}
            onApagar={apagar}
            onNova={() => setEditor(null)}
          />
        ) : (
          <AgendaMes atividades={atividades} onEditar={(a) => setEditor(a)} />
        )}
      </div>

      {editor !== undefined ? (
        <AtividadeEditor
          board={board}
          contatos={contatos}
          atividade={editor}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined);
            void carregar();
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function TabBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
        ativo
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Lista ----------------------------- */

function AgendaLista({
  atividades,
  onConcluir,
  onEditar,
  onApagar,
  onNova,
}: {
  atividades: ActivityDTO[];
  onConcluir: (a: ActivityDTO, v: boolean) => void;
  onEditar: (a: ActivityDTO) => void;
  onApagar: (a: ActivityDTO) => void;
  onNova: () => void;
}) {
  // Agrupa por dia (ordenado por inicioEm).
  const grupos = React.useMemo(() => {
    const map = new Map<string, ActivityDTO[]>();
    for (const a of [...atividades].sort((x, y) => x.inicioEm.localeCompare(y.inicioEm))) {
      const k = chaveDia(new Date(a.inicioEm));
      (map.get(k) ?? map.set(k, []).get(k)!).push(a);
    }
    return [...map.entries()];
  }, [atividades]);

  if (atividades.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <CalendarDays className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">Nada na agenda.</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onNova}>
          <Plus className="size-3.5" aria-hidden />
          Agendar algo
        </Button>
      </div>
    );
  }

  const hojeKey = chaveDia(new Date());

  return (
    <div className="flex flex-col gap-4">
      {grupos.map(([dia, itens]) => {
        const atrasado = dia < hojeKey;
        return (
          <div key={dia} className="flex flex-col gap-1.5">
            <h3
              className={cn(
                'text-xs font-semibold',
                atrasado ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {rotuloDia(itens[0].inicioEm)}
              {atrasado ? ' · atrasada' : ''}
            </h3>
            {itens.map((a) => (
              <AtividadeRow
                key={a.id}
                atividade={a}
                onConcluir={onConcluir}
                onEditar={onEditar}
                onApagar={onApagar}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AtividadeRow({
  atividade: a,
  onConcluir,
  onEditar,
  onApagar,
}: {
  atividade: ActivityDTO;
  onConcluir: (a: ActivityDTO, v: boolean) => void;
  onEditar: (a: ActivityDTO) => void;
  onApagar: (a: ActivityDTO) => void;
}) {
  const hora = a.diaInteiro
    ? null
    : new Date(a.inicioEm).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5">
      <input
        type="checkbox"
        checked={a.concluida}
        onChange={(e) => onConcluir(a, e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
        aria-label="Concluir"
      />
      <button type="button" onClick={() => onEditar(a)} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            'break-words text-sm',
            a.concluida ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          <span aria-hidden>{CRM_ACTIVITY_EMOJI[a.tipo]} </span>
          {a.titulo}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{CRM_ACTIVITY_LABELS[a.tipo]}</span>
          {hora ? (
            <>
              <span aria-hidden>·</span>
              <span>{hora}</span>
            </>
          ) : null}
          {a.cardTitulo ? (
            <Badge variant="outline" className="text-[10px]">
              {a.cardTitulo}
            </Badge>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={() => onApagar(a)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
        aria-label="Apagar atividade"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/* ----------------------------- Mês ----------------------------- */

function AgendaMes({
  atividades,
  onEditar,
}: {
  atividades: ActivityDTO[];
  onEditar: (a: ActivityDTO) => void;
}) {
  const hoje = new Date();
  const [ref, setRef] = React.useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSel, setDiaSel] = React.useState<string | null>(chaveDia(hoje));

  const porDia = React.useMemo(() => {
    const map = new Map<string, ActivityDTO[]>();
    for (const a of atividades) {
      const k = chaveDia(new Date(a.inicioEm));
      (map.get(k) ?? map.set(k, []).get(k)!).push(a);
    }
    return map;
  }, [atividades]);

  const primeiroDiaSemana = new Date(ref.ano, ref.mes, 1).getDay();
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function navegar(delta: number) {
    setRef((r) => {
      const m = r.mes + delta;
      if (m < 0) return { ano: r.ano - 1, mes: 11 };
      if (m > 11) return { ano: r.ano + 1, mes: 0 };
      return { ano: r.ano, mes: m };
    });
  }

  const itensDoDia = diaSel ? porDia.get(diaSel) ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {MESES[ref.mes]} de {ref.ano}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} />;
          const k = `${ref.ano}-${String(ref.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          const itens = porDia.get(k) ?? [];
          const ehHoje = k === chaveDia(hoje);
          const sel = k === diaSel;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setDiaSel(k)}
              className={cn(
                'flex aspect-square flex-col items-center justify-start gap-0.5 rounded-md border p-1 text-xs transition-colors',
                sel ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted',
                ehHoje && !sel ? 'border-primary/40' : '',
              )}
            >
              <span className={cn('font-medium', ehHoje ? 'text-primary' : 'text-foreground')}>
                {dia}
              </span>
              {itens.length > 0 ? (
                <span className="flex flex-wrap justify-center gap-0.5">
                  {itens.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        'size-1.5 rounded-full',
                        a.concluida ? 'bg-muted-foreground/40' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {diaSel ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {new Date(`${diaSel}T12:00:00`).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </h3>
          {itensDoDia.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada neste dia.</p>
          ) : (
            itensDoDia.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onEditar(a)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-left text-sm"
              >
                <span aria-hidden>{CRM_ACTIVITY_EMOJI[a.tipo]}</span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    a.concluida ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  {a.titulo}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- Editor ----------------------------- */

function AtividadeEditor({
  board,
  contatos,
  atividade,
  onClose,
  onSaved,
}: {
  board: BoardDTO;
  contatos: ContactDTO[];
  atividade: ActivityDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = atividade !== null;
  const inicial = atividade ? new Date(atividade.inicioEm) : new Date();

  const [titulo, setTitulo] = React.useState(atividade?.titulo ?? '');
  const [tipo, setTipo] = React.useState<CrmActivityTipo>(atividade?.tipo ?? 'tarefa');
  const [diaInteiro, setDiaInteiro] = React.useState(atividade?.diaInteiro ?? false);
  const [data, setData] = React.useState(chaveDia(inicial));
  const [hora, setHora] = React.useState(
    `${String(inicial.getHours()).padStart(2, '0')}:${String(inicial.getMinutes()).padStart(2, '0')}`,
  );
  const [descricao, setDescricao] = React.useState(atividade?.descricao ?? '');
  const [cardId, setCardId] = React.useState(atividade?.cardId ?? '');
  const [contatoId, setContatoId] = React.useState(atividade?.contatoId ?? '');
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    const t = titulo.trim();
    if (!t) {
      toast({ title: 'Dê um título à atividade' });
      return;
    }
    const inicioEm = new Date(
      diaInteiro ? `${data}T00:00:00` : `${data}T${hora || '09:00'}:00`,
    ).toISOString();

    setSalvando(true);
    try {
      const corpo = {
        titulo: t,
        tipo,
        inicioEm,
        diaInteiro,
        descricao: descricao.trim() || null,
        cardId: cardId || null,
        contatoId: contatoId || null,
      };
      const res = editando
        ? await fetch(`/api/crm/activities/${atividade.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          })
        : await fetch('/api/crm/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.erro ?? 'Falha ao salvar');
      }
      toast({ variant: 'success', title: editando ? 'Atividade salva' : 'Atividade criada' });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível salvar' });
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!editando) return;
    if (!confirm('Apagar esta atividade?')) return;
    const res = await fetch(`/api/crm/activities/${atividade.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Atividade apagada' });
      onSaved();
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar atividade' : 'Nova atividade'}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          {editando ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 text-destructive hover:text-destructive"
              onClick={() => void apagar()}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Apagar
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo rotulo="Título">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Ligar para a Padaria do João"
            autoFocus
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as CrmActivityTipo)} className={selectCls}>
              {CRM_ACTIVITY_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {CRM_ACTIVITY_LABELS[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => setDiaInteiro(e.target.checked)}
              className="size-4 accent-primary"
            />
            Dia inteiro
          </label>
          {!diaInteiro ? (
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-9 w-32"
            />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Card vinculado">
            <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={selectCls}>
              <option value="">— nenhum —</option>
              {board.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Contato">
            <select
              value={contatoId}
              onChange={(e) => setContatoId(e.target.value)}
              className={selectCls}
            >
              <option value="">— nenhum —</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Descrição">
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes (opcional)…"
            className="min-h-16 resize-y"
          />
        </Campo>
      </div>
    </Modal>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}
