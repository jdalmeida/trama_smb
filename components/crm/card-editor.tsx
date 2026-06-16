'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import type {
  CardDTO,
  ContactDTO,
  CrmValores,
  FieldDTO,
  StageDTO,
} from '@/src/domain/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Modal } from '@/components/crm/modal';
import { FieldInput } from '@/components/crm/field-input';

/**
 * Editor de card (criar/editar) com formulário 100% data-driven: o conjunto de
 * campos vem das definições do funil. Salva direto nas rotas REST e avisa o pai
 * para recarregar o board.
 */
export function CardEditor({
  pipelineId,
  stageInicial,
  stages,
  fields,
  contatos,
  card,
  onClose,
  onSaved,
}: {
  pipelineId: string;
  stageInicial?: string;
  stages: StageDTO[];
  fields: FieldDTO[];
  contatos: ContactDTO[];
  card: CardDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = card !== null;
  const [titulo, setTitulo] = React.useState(card?.titulo ?? '');
  const [stageId, setStageId] = React.useState(
    card?.stageId ?? stageInicial ?? stages[0]?.id ?? '',
  );
  const [contatoId, setContatoId] = React.useState<string>(card?.contatoId ?? '');
  const [valores, setValores] = React.useState<CrmValores>(card?.valores ?? {});
  const [salvando, setSalvando] = React.useState(false);

  function setValor(chave: string, v: unknown) {
    setValores((prev) => {
      const novo = { ...prev };
      if (v === undefined) delete novo[chave];
      else novo[chave] = v;
      return novo;
    });
  }

  async function salvar() {
    const t = titulo.trim();
    if (!t) {
      toast({ title: 'Dê um título ao card' });
      return;
    }
    setSalvando(true);
    try {
      const res = editando
        ? await fetch(`/api/crm/cards/${card.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: t, contatoId: contatoId || null, valores }),
          })
        : await fetch('/api/crm/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pipelineId,
              stageId,
              titulo: t,
              contatoId: contatoId || null,
              valores,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.erro ?? 'Falha ao salvar');
      }
      // Se editando e o stage mudou, move o card.
      if (editando && stageId && stageId !== card.stageId) {
        await fetch(`/api/crm/cards/${card.id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stageId }),
        });
      }
      toast({ variant: 'success', title: editando ? 'Card atualizado' : 'Card criado' });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível salvar' });
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!editando) return;
    if (!confirm('Apagar este card?')) return;
    try {
      const res = await fetch(`/api/crm/cards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ title: 'Card apagado' });
      onSaved();
    } catch {
      toast({ title: 'Não foi possível apagar' });
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar card' : 'Novo card'}
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
            placeholder="Ex.: Orçamento Padaria do João"
            autoFocus
          />
        </Campo>

        <Campo rotulo="Ponto do funil">
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo rotulo="Contato">
          <select
            value={contatoId}
            onChange={(e) => setContatoId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">— sem contato —</option>
            {contatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        {fields.length > 0 ? (
          <div className="mt-1 flex flex-col gap-3 border-t border-border pt-3">
            {fields.map((f) => (
              <Campo key={f.id} rotulo={f.rotulo} obrigatorio={f.obrigatorio}>
                <FieldInput
                  field={f}
                  valor={valores[f.chave]}
                  onChange={(v) => setValor(f.chave, v)}
                />
              </Campo>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Campo({
  rotulo,
  obrigatorio,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {rotulo}
        {obrigatorio ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
