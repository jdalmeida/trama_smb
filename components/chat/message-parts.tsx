'use client';

import * as React from 'react';
import { isToolUIPart, type UIMessage } from 'ai';

/** Estado de uma tool part, mapeado para rótulo + cor em pt-BR. */
const TOOL_STATE_LABEL: Record<string, string> = {
  'input-streaming': 'preparando…',
  'input-available': 'executando…',
  'output-available': 'concluído',
  'output-error': 'erro',
  'approval-requested': 'aguardando aprovação',
  'approval-responded': 'respondido',
  'output-denied': 'recusado',
};

const TOOL_STATE_STYLE: Record<string, string> = {
  'input-streaming': 'bg-stone-100 text-stone-600',
  'input-available': 'bg-amber-100 text-amber-700',
  'output-available': 'bg-emerald-100 text-emerald-700',
  'output-error': 'bg-rose-100 text-rose-700',
  'approval-requested': 'bg-sky-100 text-sky-700',
  'approval-responded': 'bg-sky-100 text-sky-700',
  'output-denied': 'bg-rose-100 text-rose-700',
};

/** Nomes amigáveis para as tools conhecidas. */
const TOOL_NOME: Record<string, string> = {
  delegarTarefa: 'Delegar tarefa',
  salvarPerfil: 'Salvar perfil',
  lerPerfil: 'Ler perfil',
};

function toolNomeAmigavel(toolName: string): string {
  return TOOL_NOME[toolName] ?? toolName;
}

/** Extrai o nome da tool a partir de `tool-<nome>`. */
function nomeDaTool(type: string): string {
  return type.startsWith('tool-') ? type.slice('tool-'.length) : type;
}

export interface MessagePartsProps {
  message: UIMessage;
}

export function MessageParts({ message }: MessagePartsProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--color-brand)] text-white'
            : 'bg-white text-[var(--color-ink)] shadow-sm ring-1 ring-black/5'
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }

          if (part.type === 'reasoning') {
            return (
              <p
                key={i}
                className="whitespace-pre-wrap text-xs italic text-[var(--color-muted)]"
              >
                {part.text}
              </p>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = nomeDaTool(part.type);
            return (
              <ToolChip
                key={i}
                toolName={toolName}
                state={part.state}
                input={'input' in part ? part.input : undefined}
                output={'output' in part ? part.output : undefined}
                errorText={'errorText' in part ? part.errorText : undefined}
              />
            );
          }

          if (part.type.startsWith('data-')) {
            const dataName = part.type.slice('data-'.length);
            const data = (part as { data?: unknown }).data;
            return <DataChip key={i} name={dataName} data={data} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ToolChip({
  toolName,
  state,
  input,
  output,
  errorText,
}: {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const stateLabel = TOOL_STATE_LABEL[state] ?? state;
  const stateStyle = TOOL_STATE_STYLE[state] ?? 'bg-stone-100 text-stone-600';

  return (
    <div className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-stone-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-ink)]">
          {toolNomeAmigavel(toolName)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateStyle}`}
        >
          {stateLabel}
        </span>
      </div>
      <ToolDetalhe
        toolName={toolName}
        state={state}
        input={input}
        output={output}
        errorText={errorText}
      />
    </div>
  );
}

function ToolDetalhe({
  toolName,
  state,
  input,
  output,
  errorText,
}: {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  if (state === 'output-error' && errorText) {
    return <p className="mt-1 text-xs text-rose-600">{errorText}</p>;
  }

  // Erro "soft" devolvido pela tool (ex.: delegar sem perfil salvo): { ok:false, erro }
  if (state === 'output-available' && isRecord(output) && output.ok === false) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        {getString(output, 'erro') ?? 'Não foi possível concluir esta ação.'}
      </p>
    );
  }

  // proporPlano: mostra o resumo do plano proposto
  if (
    toolName === 'proporPlano' &&
    state === 'output-available' &&
    isRecord(output)
  ) {
    const plano = isRecord(output.plano) ? output.plano : undefined;
    const resumo = plano ? getString(plano, 'resumo') : undefined;
    if (resumo) {
      return <p className="mt-1 text-xs text-stone-600">{resumo}</p>;
    }
  }

  // delegarTarefa: mensagem amigável quando concluído
  if (toolName === 'delegarTarefa') {
    if (state === 'output-available' && isRecord(output)) {
      const persona =
        getString(output, 'persona') ?? getString(output, 'personaId');
      return (
        <p className="mt-1 text-xs text-stone-600">
          Tarefa enviada para{' '}
          <span className="font-medium">{persona ?? 'o time'}</span>. Acompanhe
          no painel ao lado.
        </p>
      );
    }
    if (isRecord(input)) {
      const tarefa = getString(input, 'tarefa');
      if (tarefa) {
        return (
          <p className="mt-1 line-clamp-2 text-xs text-stone-600">{tarefa}</p>
        );
      }
    }
    return (
      <p className="mt-1 text-xs text-stone-600">Delegando para o time…</p>
    );
  }

  // salvarPerfil
  if (toolName === 'salvarPerfil') {
    if (state === 'output-available') {
      return (
        <p className="mt-1 text-xs text-stone-600">
          Perfil do negócio salvo. Confira o resumo abaixo do chat.
        </p>
      );
    }
    return (
      <p className="mt-1 text-xs text-stone-600">Organizando o perfil…</p>
    );
  }

  return null;
}

function DataChip({ name, data }: { name: string; data: unknown }) {
  return (
    <div className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-stone-700">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {name}
      </span>
      {typeof data === 'string' ? (
        <p className="mt-1 whitespace-pre-wrap text-xs">{data}</p>
      ) : (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] leading-snug">
          {safeStringify(data)}
        </pre>
      )}
    </div>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
