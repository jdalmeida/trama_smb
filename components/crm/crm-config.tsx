'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { BoardDTO, FieldDTO, StageDTO } from '@/src/domain/crm';
import {
  CRM_FIELD_TYPES,
  CRM_FIELD_TYPE_LABELS,
  CRM_STAGE_TIPOS,
  type CrmFieldType,
  type CrmStageTipo,
} from '@/src/domain/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { Modal } from '@/components/crm/modal';

const selectCls =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const TIPO_STAGE_LABEL: Record<CrmStageTipo, string> = {
  aberto: 'Aberto',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

/**
 * Configuração de um funil: pontos (stages) e campos de card (data-driven).
 * É aqui que o dono molda o CRM. Toda mudança persiste via REST e dispara
 * onRefresh para o board refletir.
 */
export function CrmConfig({
  board,
  onClose,
  onRefresh,
}: {
  board: BoardDTO;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <Modal titulo={`Configurar “${board.pipeline.nome}”`} onClose={onClose} className="max-w-2xl">
      <Tabs defaultValue="pontos" className="flex flex-col gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="pontos" className="flex-1">
            Pontos do funil
          </TabsTrigger>
          <TabsTrigger value="campos" className="flex-1">
            Campos do card
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pontos" className="mt-0">
          <PontosConfig board={board} onRefresh={onRefresh} />
        </TabsContent>
        <TabsContent value="campos" className="mt-0">
          <CamposConfig board={board} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

/* ----------------------------- Pontos ----------------------------- */

function PontosConfig({ board, onRefresh }: { board: BoardDTO; onRefresh: () => void }) {
  const stages = React.useMemo(
    () => [...board.stages].sort((a, b) => a.ordem - b.ordem),
    [board.stages],
  );
  const [novo, setNovo] = React.useState('');
  const [novoTipo, setNovoTipo] = React.useState<CrmStageTipo>('aberto');

  async function criar() {
    const nome = novo.trim();
    if (!nome) return;
    const res = await fetch('/api/crm/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineId: board.pipeline.id, nome, tipo: novoTipo }),
    });
    if (res.ok) {
      setNovo('');
      setNovoTipo('aberto');
      onRefresh();
    } else {
      toast({ title: 'Não foi possível criar o ponto' });
    }
  }

  async function editar(stage: StageDTO, patch: Partial<Pick<StageDTO, 'nome' | 'tipo' | 'cor'>>) {
    const res = await fetch(`/api/crm/stages/${stage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) onRefresh();
  }

  async function apagar(stage: StageDTO) {
    if (stages.length <= 1) {
      toast({ title: 'Um funil precisa de ao menos um ponto' });
      return;
    }
    if (!confirm(`Apagar o ponto “${stage.nome}”? Os cards vão para o ponto seguinte.`)) return;
    const res = await fetch(`/api/crm/stages/${stage.id}`, { method: 'DELETE' });
    if (res.ok) onRefresh();
    else {
      const data = await res.json().catch(() => ({}));
      toast({ title: data?.erro ?? 'Não foi possível apagar' });
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    const novoIdx = idx + dir;
    if (novoIdx < 0 || novoIdx >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[idx], ids[novoIdx]] = [ids[novoIdx], ids[idx]];
    const res = await fetch('/api/crm/stages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineId: board.pipeline.id, orderedIds: ids }),
    });
    if (res.ok) onRefresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {stages.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
          >
            <input
              type="color"
              value={s.cor}
              onChange={(e) => void editar(s, { cor: e.target.value })}
              className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label={`Cor de ${s.nome}`}
            />
            <Input
              defaultValue={s.nome}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.nome) void editar(s, { nome: v });
              }}
              className="h-8 flex-1"
            />
            <select
              value={s.tipo}
              onChange={(e) => void editar(s, { tipo: e.target.value as CrmStageTipo })}
              className={selectCls}
            >
              {CRM_STAGE_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_STAGE_LABEL[t]}
                </option>
              ))}
            </select>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => void mover(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Subir"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void mover(i, 1)}
                disabled={i === stages.length - 1}
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Descer"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void apagar(s)}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label="Apagar ponto"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void criar();
          }}
          placeholder="Novo ponto do funil…"
          className="h-9 flex-1"
        />
        <select
          value={novoTipo}
          onChange={(e) => setNovoTipo(e.target.value as CrmStageTipo)}
          className={selectCls}
        >
          {CRM_STAGE_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_STAGE_LABEL[t]}
            </option>
          ))}
        </select>
        <Button size="sm" className="gap-1.5" onClick={() => void criar()}>
          <Plus className="size-3.5" aria-hidden />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Campos ----------------------------- */

function CamposConfig({ board, onRefresh }: { board: BoardDTO; onRefresh: () => void }) {
  const fields = React.useMemo(
    () => [...board.fields].sort((a, b) => a.ordem - b.ordem),
    [board.fields],
  );
  const [criando, setCriando] = React.useState(false);

  async function apagar(field: FieldDTO) {
    if (!confirm(`Remover o campo “${field.rotulo}”?`)) return;
    const res = await fetch(`/api/crm/fields/${field.id}`, { method: 'DELETE' });
    if (res.ok) onRefresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {fields.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {f.rotulo}
                {f.obrigatorio ? <span className="text-destructive"> *</span> : null}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {CRM_FIELD_TYPE_LABELS[f.tipo]}
                {f.opcoes.length > 0 ? ` · ${f.opcoes.join(', ')}` : ''}
                {f.pipelineId ? '' : ' · todos os funis'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void apagar(f)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              aria-label="Remover campo"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
        {fields.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Nenhum campo ainda. Adicione os campos que você quer registrar em cada card.
          </li>
        ) : null}
      </ul>

      {criando ? (
        <NovoCampo
          pipelineId={board.pipeline.id}
          onClose={() => setCriando(false)}
          onSaved={() => {
            setCriando(false);
            onRefresh();
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 gap-1.5 self-start"
          onClick={() => setCriando(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Novo campo
        </Button>
      )}
    </div>
  );
}

function NovoCampo({
  pipelineId,
  onClose,
  onSaved,
}: {
  pipelineId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rotulo, setRotulo] = React.useState('');
  const [tipo, setTipo] = React.useState<CrmFieldType>('text');
  const [opcoes, setOpcoes] = React.useState('');
  const [obrigatorio, setObrigatorio] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);

  const precisaOpcoes = tipo === 'select' || tipo === 'multiselect';

  async function salvar() {
    const r = rotulo.trim();
    if (!r) {
      toast({ title: 'Dê um nome ao campo' });
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/crm/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidade: 'card',
          pipelineId,
          rotulo: r,
          tipo,
          obrigatorio,
          opcoes: precisaOpcoes
            ? opcoes.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      toast({ title: 'Não foi possível criar o campo' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex gap-2">
        <Input
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          placeholder="Nome do campo (ex.: Valor estimado)"
          className="h-9 flex-1"
          autoFocus
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as CrmFieldType)}
          className={selectCls}
        >
          {CRM_FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {CRM_FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {precisaOpcoes ? (
        <Input
          value={opcoes}
          onChange={(e) => setOpcoes(e.target.value)}
          placeholder="Opções separadas por vírgula (ex.: Indicação, Instagram, Site)"
          className="h-9"
        />
      ) : null}

      <div className="flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={obrigatorio}
            onChange={(e) => setObrigatorio(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Obrigatório
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Adicionar campo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
