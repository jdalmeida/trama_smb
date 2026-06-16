'use client';

import * as React from 'react';
import { Plus, Search, Trash2, User } from 'lucide-react';
import type { ContactDTO, CrmValores, FieldDTO } from '@/src/domain/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { Modal } from '@/components/crm/modal';
import { FieldInput, formatarValorCampo } from '@/components/crm/field-input';

/**
 * Lista e edição de contatos (cadastro data-driven, reutilizável entre funis).
 * Os campos do formulário vêm das definições de contato do negócio.
 */
export function CrmContacts({
  contatos,
  onRefresh,
}: {
  contatos: ContactDTO[];
  onRefresh: () => void;
}) {
  const [fields, setFields] = React.useState<FieldDTO[]>([]);
  const [busca, setBusca] = React.useState('');
  const [editor, setEditor] = React.useState<ContactDTO | null | undefined>(undefined);
  // undefined = fechado, null = criando, ContactDTO = editando.

  React.useEffect(() => {
    fetch('/api/crm/fields?entidade=contato')
      .then((r) => (r.ok ? r.json() : { fields: [] }))
      .then((d) => setFields(d.fields ?? []))
      .catch(() => setFields([]));
  }, []);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contatos;
    return contatos.filter((c) => c.nome.toLowerCase().includes(q));
  }, [busca, contatos]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar contato…"
            className="h-9 pl-8"
          />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditor(null)}>
          <Plus className="size-3.5" aria-hidden />
          Novo contato
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <User className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {contatos.length === 0
                ? 'Nenhum contato cadastrado ainda.'
                : 'Nenhum contato encontrado.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditor(c)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {fields
                        .map((f) => ({ f, txt: formatarValorCampo(f, c.valores[f.chave]) }))
                        .filter((x) => x.txt)
                        .slice(0, 4)
                        .map(({ f, txt }) => (
                          <Badge key={f.id} variant="outline" className="text-[10px]">
                            {f.rotulo}: {txt}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor !== undefined ? (
        <ContatoEditor
          contato={editor}
          fields={fields}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ContatoEditor({
  contato,
  fields,
  onClose,
  onSaved,
}: {
  contato: ContactDTO | null;
  fields: FieldDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = contato !== null;
  const [nome, setNome] = React.useState(contato?.nome ?? '');
  const [valores, setValores] = React.useState<CrmValores>(contato?.valores ?? {});
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
    const n = nome.trim();
    if (!n) {
      toast({ title: 'Informe o nome do contato' });
      return;
    }
    setSalvando(true);
    try {
      const res = editando
        ? await fetch(`/api/crm/contacts/${contato.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: n, valores }),
          })
        : await fetch('/api/crm/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: n, valores }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.erro ?? 'Falha ao salvar');
      }
      toast({ variant: 'success', title: editando ? 'Contato atualizado' : 'Contato criado' });
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Não foi possível salvar' });
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!editando) return;
    if (!confirm('Apagar este contato?')) return;
    const res = await fetch(`/api/crm/contacts/${contato.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Contato apagado' });
      onSaved();
    } else toast({ title: 'Não foi possível apagar' });
  }

  return (
    <Modal
      titulo={editando ? 'Editar contato' : 'Novo contato'}
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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do contato ou empresa"
            autoFocus
          />
        </label>
        {fields.map((f) => (
          <label key={f.id} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {f.rotulo}
              {f.obrigatorio ? <span className="text-destructive"> *</span> : null}
            </span>
            <FieldInput field={f} valor={valores[f.chave]} onChange={(v) => setValor(f.chave, v)} />
          </label>
        ))}
      </div>
    </Modal>
  );
}
