'use client';

import * as React from 'react';
import type { CrmValores, FieldDTO } from '@/src/domain/crm';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Renderiza o input adequado para um campo customizável (data-driven), conforme
 * seu tipo. É o elo visual entre as definições de campo do dono e os formulários
 * de card/contato. Controlado: recebe o valor atual e emite mudanças.
 */
export function FieldInput({
  field,
  valor,
  onChange,
}: {
  field: FieldDTO;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f_${field.id}`;

  switch (field.tipo) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 resize-y"
          placeholder={field.rotulo}
        />
      );

    case 'number':
    case 'currency':
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={field.tipo === 'currency' ? '0.01' : 'any'}
          value={valor === undefined || valor === null ? '' : String(valor)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
          placeholder={field.tipo === 'currency' ? 'R$ 0,00' : '0'}
        />
      );

    case 'date':
      return (
        <Input
          id={id}
          type="date"
          value={typeof valor === 'string' ? valor.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    case 'boolean':
      return (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={valor === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-muted-foreground">{field.rotulo}</span>
        </label>
      );

    case 'select':
      return (
        <select
          id={id}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">—</option>
          {field.opcoes.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      );

    case 'multiselect': {
      const selecionados: string[] = Array.isArray(valor) ? valor.map(String) : [];
      const toggle = (op: string) => {
        const novo = selecionados.includes(op)
          ? selecionados.filter((x) => x !== op)
          : [...selecionados, op];
        onChange(novo);
      };
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.opcoes.map((op) => {
            const ativo = selecionados.includes(op);
            return (
              <button
                key={op}
                type="button"
                onClick={() => toggle(op)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  ativo
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {op}
              </button>
            );
          })}
          {field.opcoes.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sem opções definidas.</span>
          ) : null}
        </div>
      );
    }

    case 'email':
    case 'phone':
    case 'url':
    case 'text':
    default:
      return (
        <Input
          id={id}
          type={field.tipo === 'email' ? 'email' : field.tipo === 'url' ? 'url' : 'text'}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={field.rotulo}
        />
      );
  }
}

/** Formata o valor de um campo para exibição (chips do card, lista de contatos). */
export function formatarValorCampo(field: FieldDTO, valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '';
  switch (field.tipo) {
    case 'currency': {
      const n = Number(valor);
      return Number.isNaN(n)
        ? String(valor)
        : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    case 'number':
      return String(valor);
    case 'date': {
      const d = new Date(String(valor));
      return Number.isNaN(d.getTime())
        ? String(valor)
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    case 'boolean':
      return valor === true ? 'Sim' : 'Não';
    case 'multiselect':
      return Array.isArray(valor) ? valor.join(', ') : String(valor);
    default:
      return String(valor);
  }
}

/** Soma os valores de um campo currency entre vários conjuntos de valores. */
export function somarCurrency(field: FieldDTO, conjuntos: CrmValores[]): number {
  return conjuntos.reduce((acc, v) => {
    const n = Number(v[field.chave]);
    return acc + (Number.isNaN(n) ? 0 : n);
  }, 0);
}
