'use client';

import * as React from 'react';
import { History, Plus, Trash2, Zap } from 'lucide-react';
import type { BoardDTO } from '@/src/domain/crm';
import {
  CRM_ACAO_LABELS,
  CRM_ACAO_TIPOS,
  CRM_OPERADORES,
  CRM_OPERADOR_LABELS,
  CRM_TRIGGERS,
  CRM_TRIGGER_LABELS,
  CAMPO_TITULO,
  OPERADORES_SEM_VALOR,
  type AutomationDTO,
  type AutomationRunDTO,
  type CrmAcao,
  type CrmAcaoTipo,
  type CrmCondicao,
  type CrmOperador,
  type CrmTrigger,
} from '@/src/domain/crm-automation';
import {
  CRM_ACTIVITY_LABELS,
  CRM_ACTIVITY_TIPOS,
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
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Painel de automações de um funil (Leva 2). Lista as regras gatilho→ação,
 * permite ativar/editar/apagar e criar novas, e mostra o histórico de execução.
 */
export function CrmAutomations({
  board,
  onRefresh,
}: {
  board: BoardDTO;
  onRefresh: () => void;
}) {
  const pipelineId = board.pipeline.id;
  const [automacoes, setAutomacoes] = React.useState<AutomationDTO[]>([]);
  const [runs, setRuns] = React.useState<AutomationRunDTO[]>([]);
  const [editor, setEditor] = React.useState<AutomationDTO | null | undefined>(undefined);
  const [mostrarHistorico, setMostrarHistorico] = React.useState(false);

  const carregar = React.useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        fetch(`/api/crm/automations?pipelineId=${pipelineId}`).then((x) =>
          x.ok ? x.json() : { automacoes: [] },
        ),
        fetch(`/api/crm/automations/runs?pipelineId=${pipelineId}`).then((x) =>
          x.ok ? x.json() : { runs: [] },
        ),
      ]);
      setAutomacoes(a.automacoes ?? []);
      setRuns(r.runs ?? []);
    } catch {
      // silencioso
    }
  }, [pipelineId]);

  React.useEffect(() => {
    void carregar();
  }, [carregar]);

  async function toggle(a: AutomationDTO) {
    setAutomacoes((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)),
    );
    await fetch(`/api/crm/automations/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    void carregar();
  }

  async function apagar(a: AutomationDTO) {
    if (!confirm(`Apagar a automação “${a.nome}”?`)) return;
    await fetch(`/api/crm/automations/${a.id}`, { method: 'DELETE' });
    void carregar();
  }

  async function verificarParadas() {
    try {
      const res = await fetch('/api/crm/automations/tick', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { disparos?: number };
      toast({
        variant: 'success',
        title:
          data.disparos && data.disparos > 0
            ? `${data.disparos} automação(ões) dispararam`
            : 'Nenhuma automação parada para disparar',
      });
      void carregar();
      onRefresh();
    } catch {
      toast({ title: 'Não foi possível verificar' });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Regras que rodam sozinhas quando algo acontece no funil “{board.pipeline.nome}”.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void verificarParadas()}
          >
            <Zap className="size-3.5" aria-hidden />
            Verificar paradas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setMostrarHistorico((v) => !v)}
          >
            <History className="size-3.5" aria-hidden />
            Histórico
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditor(null)}>
            <Plus className="size-3.5" aria-hidden />
            Nova automação
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {mostrarHistorico ? (
          <HistoricoLista runs={runs} />
        ) : automacoes.length === 0 ? (
          <EstadoVazio onNova={() => setEditor(null)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {automacoes.map((a) => (
              <AutomationItem
                key={a.id}
                automacao={a}
                board={board}
                onToggle={() => void toggle(a)}
                onEdit={() => setEditor(a)}
                onDelete={() => void apagar(a)}
              />
            ))}
          </ul>
        )}
      </div>

      {editor !== undefined ? (
        <AutomationEditor
          board={board}
          automacao={editor}
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

function AutomationItem({
  automacao,
  board,
  onToggle,
  onEdit,
  onDelete,
}: {
  automacao: AutomationDTO;
  board: BoardDTO;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stageNome = (id: string | null) =>
    id ? board.stages.find((s) => s.id === id)?.nome ?? '—' : null;

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          automacao.enabled ? 'bg-primary' : 'bg-muted',
        )}
        role="switch"
        aria-checked={automacao.enabled}
        aria-label={automacao.enabled ? 'Desativar' : 'Ativar'}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-background shadow transition-transform',
            automacao.enabled ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground">{automacao.nome}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {CRM_TRIGGER_LABELS[automacao.trigger]}
          {automacao.trigger === 'card_movido' && automacao.triggerStageId
            ? `: ${stageNome(automacao.triggerStageId)}`
            : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {automacao.condicoes.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {automacao.condicoes.length} condição
              {automacao.condicoes.length > 1 ? 'ões' : ''}
            </Badge>
          ) : null}
          {automacao.acoes.map((ac, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-[10px]">
              <Zap className="size-2.5" aria-hidden />
              {CRM_ACAO_LABELS[ac.tipo]}
            </Badge>
          ))}
        </div>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
        aria-label="Apagar automação"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

function HistoricoLista({ runs }: { runs: AutomationRunDTO[] }) {
  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
        Nenhuma automação rodou ainda.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {runs.map((r) => (
        <li
          key={r.id}
          className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-xs"
        >
          <span
            className={cn(
              'mt-1 size-2 shrink-0 rounded-full',
              r.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500',
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="break-words text-foreground">{r.mensagem}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {new Date(r.criadoEm).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EstadoVazio({ onNova }: { onNova: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Zap className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Sem automações ainda</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Crie regras que rodam sozinhas — ex.: ao mover um card para “Ganho”,
          registrar uma nota; ou ao criar um lead, preencher um campo.
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onNova}>
        <Plus className="size-3.5" aria-hidden />
        Criar automação
      </Button>
    </div>
  );
}

/* ----------------------------- Editor ----------------------------- */

function AutomationEditor({
  board,
  automacao,
  onClose,
  onSaved,
}: {
  board: BoardDTO;
  automacao: AutomationDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = automacao !== null;
  const stages = React.useMemo(
    () => [...board.stages].sort((a, b) => a.ordem - b.ordem),
    [board.stages],
  );

  const [nome, setNome] = React.useState(automacao?.nome ?? '');
  const [trigger, setTrigger] = React.useState<CrmTrigger>(
    automacao?.trigger ?? 'card_movido',
  );
  const [triggerStageId, setTriggerStageId] = React.useState<string>(
    automacao?.triggerStageId ?? stages[0]?.id ?? '',
  );
  const [triggerDias, setTriggerDias] = React.useState<number>(
    automacao?.triggerDias ?? 3,
  );
  const [condicoes, setCondicoes] = React.useState<CrmCondicao[]>(
    automacao?.condicoes ?? [],
  );
  const [acoes, setAcoes] = React.useState<CrmAcao[]>(
    automacao?.acoes ?? [novaAcao('registrar_nota', stages, board.fields)],
  );
  const [salvando, setSalvando] = React.useState(false);

  function novaCondicao(): CrmCondicao {
    return {
      campo: board.fields[0]?.chave ?? CAMPO_TITULO,
      operador: 'igual',
      valor: '',
    };
  }

  async function salvar() {
    const n = nome.trim();
    if (!n) {
      toast({ title: 'Dê um nome à automação' });
      return;
    }
    if (acoes.length === 0) {
      toast({ title: 'Adicione ao menos uma ação' });
      return;
    }
    setSalvando(true);
    try {
      const corpoComum = {
        nome: n,
        condicoes,
        acoes,
        triggerStageId: trigger === 'card_movido' ? triggerStageId || null : null,
        triggerDias: trigger === 'card_parado' ? triggerDias : null,
      };
      const res = editando
        ? await fetch(`/api/crm/automations/${automacao.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpoComum),
          })
        : await fetch('/api/crm/automations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...corpoComum,
              pipelineId: board.pipeline.id,
              trigger,
              enabled: true,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.erro ?? 'Falha ao salvar');
      }
      toast({ variant: 'success', title: editando ? 'Automação salva' : 'Automação criada' });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível salvar' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar automação' : 'Nova automação'}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Avisar quando virar Ganho"
            autoFocus
          />
        </label>

        {/* Gatilho */}
        <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quando
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as CrmTrigger)}
              disabled={editando}
              className={cn(selectCls, 'flex-1', editando && 'opacity-60')}
            >
              {CRM_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {CRM_TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
            {trigger === 'card_movido' ? (
              <select
                value={triggerStageId}
                onChange={(e) => setTriggerStageId(e.target.value)}
                className={cn(selectCls, 'flex-1')}
              >
                <option value="">qualquer ponto</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            ) : null}
            {trigger === 'card_parado' ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  value={triggerDias}
                  onChange={(e) => setTriggerDias(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 w-20"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            ) : null}
          </div>
          {editando ? (
            <p className="text-[10px] text-muted-foreground">
              O gatilho não muda na edição — para trocá-lo, crie uma nova automação.
            </p>
          ) : null}
        </section>

        {/* Condições */}
        <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Se (opcional)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setCondicoes((p) => [...p, novaCondicao()])}
            >
              <Plus className="size-3" aria-hidden />
              Condição
            </Button>
          </div>
          {condicoes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem condições — roda sempre que o gatilho acontecer.
            </p>
          ) : (
            condicoes.map((c, i) => (
              <CondicaoRow
                key={i}
                board={board}
                cond={c}
                onChange={(nv) =>
                  setCondicoes((p) => p.map((x, j) => (j === i ? nv : x)))
                }
                onRemove={() => setCondicoes((p) => p.filter((_, j) => j !== i))}
              />
            ))
          )}
        </section>

        {/* Ações */}
        <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Então
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setAcoes((p) => [...p, novaAcao('registrar_nota', stages, board.fields)])}
            >
              <Plus className="size-3" aria-hidden />
              Ação
            </Button>
          </div>
          {acoes.map((a, i) => (
            <AcaoRow
              key={i}
              board={board}
              acao={a}
              onChange={(nv) => setAcoes((p) => p.map((x, j) => (j === i ? nv : x)))}
              onRemove={() => setAcoes((p) => p.filter((_, j) => j !== i))}
              podeRemover={acoes.length > 1}
            />
          ))}
        </section>
      </div>
    </Modal>
  );
}

function CondicaoRow({
  board,
  cond,
  onChange,
  onRemove,
}: {
  board: BoardDTO;
  cond: CrmCondicao;
  onChange: (c: CrmCondicao) => void;
  onRemove: () => void;
}) {
  const semValor = OPERADORES_SEM_VALOR.includes(cond.operador);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={cond.campo}
        onChange={(e) => onChange({ ...cond, campo: e.target.value })}
        className={cn(selectCls, 'min-w-28 flex-1')}
      >
        <option value={CAMPO_TITULO}>Título</option>
        {board.fields.map((f) => (
          <option key={f.id} value={f.chave}>
            {f.rotulo}
          </option>
        ))}
      </select>
      <select
        value={cond.operador}
        onChange={(e) => onChange({ ...cond, operador: e.target.value as CrmOperador })}
        className={selectCls}
      >
        {CRM_OPERADORES.map((o) => (
          <option key={o} value={o}>
            {CRM_OPERADOR_LABELS[o]}
          </option>
        ))}
      </select>
      {!semValor ? (
        <Input
          value={cond.valor ?? ''}
          onChange={(e) => onChange({ ...cond, valor: e.target.value })}
          placeholder="valor"
          className="h-9 min-w-24 flex-1"
        />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:text-destructive"
        aria-label="Remover condição"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function AcaoRow({
  board,
  acao,
  onChange,
  onRemove,
  podeRemover,
}: {
  board: BoardDTO;
  acao: CrmAcao;
  onChange: (a: CrmAcao) => void;
  onRemove: () => void;
  podeRemover: boolean;
}) {
  const stages = [...board.stages].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-2">
      <div className="flex items-center gap-1.5">
        <select
          value={acao.tipo}
          onChange={(e) => onChange(novaAcao(e.target.value as CrmAcaoTipo, stages, board.fields))}
          className={cn(selectCls, 'flex-1')}
        >
          {CRM_ACAO_TIPOS.map((t) => (
            <option key={t} value={t}>
              {CRM_ACAO_LABELS[t]}
            </option>
          ))}
        </select>
        {podeRemover ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
            aria-label="Remover ação"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      {acao.tipo === 'mover_card' ? (
        <select
          value={acao.stageId}
          onChange={(e) => onChange({ tipo: 'mover_card', stageId: e.target.value })}
          className={selectCls}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      ) : null}

      {acao.tipo === 'definir_campo' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={acao.chave}
            onChange={(e) => onChange({ ...acao, chave: e.target.value })}
            className={cn(selectCls, 'flex-1')}
          >
            {board.fields.length === 0 ? <option value="">(sem campos)</option> : null}
            {board.fields.map((f) => (
              <option key={f.id} value={f.chave}>
                {f.rotulo}
              </option>
            ))}
          </select>
          <Input
            value={acao.valor}
            onChange={(e) => onChange({ ...acao, valor: e.target.value })}
            placeholder="valor"
            className="h-9 min-w-24 flex-1"
          />
        </div>
      ) : null}

      {acao.tipo === 'registrar_nota' ? (
        <div className="flex flex-col gap-1.5">
          <Input
            value={acao.titulo}
            onChange={(e) => onChange({ ...acao, titulo: e.target.value })}
            placeholder="Título da nota (use {card} p/ o título do card)"
            className="h-9"
          />
          <Textarea
            value={acao.conteudo}
            onChange={(e) => onChange({ ...acao, conteudo: e.target.value })}
            placeholder="Conteúdo da nota…"
            className="min-h-16 resize-y"
          />
        </div>
      ) : null}

      {acao.tipo === 'criar_atividade' ? (
        <div className="flex flex-col gap-1.5">
          <Input
            value={acao.titulo}
            onChange={(e) => onChange({ ...acao, titulo: e.target.value })}
            placeholder="Título da atividade (use {card})"
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={acao.tipoAtividade}
              onChange={(e) =>
                onChange({ ...acao, tipoAtividade: e.target.value as CrmActivityTipo })
              }
              className={cn(selectCls, 'flex-1')}
            >
              {CRM_ACTIVITY_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {CRM_ACTIVITY_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">daqui</span>
              <Input
                type="number"
                min={0}
                value={acao.emDias}
                onChange={(e) =>
                  onChange({ ...acao, emDias: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-9 w-16"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Cria uma ação default do tipo dado, com params iniciais válidos. */
function novaAcao(
  tipo: CrmAcaoTipo,
  stages: { id: string }[],
  fields: { chave: string }[] = [],
): CrmAcao {
  switch (tipo) {
    case 'mover_card':
      return { tipo: 'mover_card', stageId: stages[0]?.id ?? '' };
    case 'definir_campo':
      return { tipo: 'definir_campo', chave: fields[0]?.chave ?? '', valor: '' };
    case 'criar_atividade':
      return {
        tipo: 'criar_atividade',
        titulo: 'Follow-up: {card}',
        tipoAtividade: 'followup',
        emDias: 2,
      };
    case 'registrar_nota':
    default:
      return { tipo: 'registrar_nota', titulo: '', conteudo: '' };
  }
}
