'use client';

import * as React from 'react';
import { isToolUIPart, type UIMessage } from 'ai';
import { Streamdown } from 'streamdown';
import {
  CircleCheck,
  CircleX,
  Clock,
  FileText,
  Loader2,
  ScrollText,
  Send,
  ShieldQuestion,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BotIcon } from '@/components/ui/bot';
import { cn } from '@/lib/utils';

/** Estado de uma tool part, mapeado para rótulo em pt-BR. */
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
  'input-streaming': 'bg-muted text-muted-foreground',
  'input-available': 'bg-amber-100 text-amber-700',
  'output-available': 'bg-emerald-100 text-emerald-700',
  'output-error': 'bg-rose-100 text-rose-700',
  'approval-requested': 'bg-sky-100 text-sky-700',
  'approval-responded': 'bg-sky-100 text-sky-700',
  'output-denied': 'bg-rose-100 text-rose-700',
};

const TOOL_STATE_ICON: Record<string, LucideIcon> = {
  'input-streaming': Loader2,
  'input-available': Loader2,
  'output-available': CircleCheck,
  'output-error': CircleX,
  'approval-requested': ShieldQuestion,
  'approval-responded': ShieldQuestion,
  'output-denied': CircleX,
};

/** Nomes amigáveis para as tools conhecidas. */
const TOOL_NOME: Record<string, string> = {
  delegarTarefa: 'Delegar tarefa',
  delegarPlano: 'Delegar plano',
  proporPlano: 'Propor plano',
  salvarPerfil: 'Salvar perfil',
  lerPerfil: 'Ler perfil',
};

/** Ícone (lucide) por tool conhecida. */
const TOOL_ICONE: Record<string, LucideIcon> = {
  delegarTarefa: Send,
  delegarPlano: Workflow,
  proporPlano: ScrollText,
  salvarPerfil: FileText,
  lerPerfil: FileText,
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
      className={cn(
        'flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser ? <AvatarCeo /> : null}
      <div
        className={cn(
          'max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border bg-card text-card-foreground shadow-sm',
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            // Usuário: texto puro. Assistente: markdown renderizado (streamdown).
            if (isUser) {
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              );
            }
            return (
              <Streamdown key={i} className="space-y-2">
                {part.text}
              </Streamdown>
            );
          }

          if (part.type === 'reasoning') {
            return (
              <p
                key={i}
                className="whitespace-pre-wrap text-xs italic text-muted-foreground"
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

/** Avatar do CEO — o BotIcon anima sozinho no hover do wrapper. */
function AvatarCeo() {
  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
      aria-hidden
    >
      <BotIcon size={16} />
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
  const stateStyle = TOOL_STATE_STYLE[state] ?? 'bg-muted text-muted-foreground';
  const StateIcon = TOOL_STATE_ICON[state] ?? Clock;
  const ToolIcon = TOOL_ICONE[toolName] ?? Wrench;
  const girando = state === 'input-streaming' || state === 'input-available';

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <ToolIcon aria-hidden />
          {toolNomeAmigavel(toolName)}
        </Badge>
        <Badge className={cn('gap-1', stateStyle)}>
          <StateIcon className={girando ? 'animate-spin' : undefined} aria-hidden />
          {stateLabel}
        </Badge>
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
    return <p className="mt-1.5 text-xs text-destructive">{errorText}</p>;
  }

  // Erro "soft" devolvido pela tool (ex.: delegar sem perfil salvo): { ok:false, erro }
  if (state === 'output-available' && isRecord(output) && output.ok === false) {
    return (
      <p className="mt-1.5 text-xs text-amber-700">
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
      return <p className="mt-1.5 text-xs text-muted-foreground">{resumo}</p>;
    }
  }

  // delegarPlano: mensagem amigável quando concluído
  if (toolName === 'delegarPlano') {
    if (state === 'output-available' && isRecord(output)) {
      const itens = Array.isArray(output.itens) ? output.itens.length : 0;
      return (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Plano enviado para o time
          {itens ? ` (${itens} ${itens === 1 ? 'tarefa' : 'tarefas'})` : ''}.
          Acompanhe no painel ao lado.
        </p>
      );
    }
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">Acionando o time…</p>
    );
  }

  // delegarTarefa: mensagem amigável quando concluído
  if (toolName === 'delegarTarefa') {
    if (state === 'output-available' && isRecord(output)) {
      const persona =
        getString(output, 'persona') ?? getString(output, 'personaId');
      return (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tarefa enviada para{' '}
          <span className="font-medium text-foreground">
            {persona ?? 'o time'}
          </span>
          . Acompanhe no painel ao lado.
        </p>
      );
    }
    if (isRecord(input)) {
      const tarefa = getString(input, 'tarefa');
      if (tarefa) {
        return (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
            {tarefa}
          </p>
        );
      }
    }
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Delegando para o time…
      </p>
    );
  }

  // salvarPerfil
  if (toolName === 'salvarPerfil') {
    if (state === 'output-available') {
      return (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Perfil do negócio salvo. Confira o resumo abaixo do chat.
        </p>
      );
    }
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Organizando o perfil…
      </p>
    );
  }

  return null;
}

function DataChip({ name, data }: { name: string; data: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {name}
      </span>
      {typeof data === 'string' ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
          {data}
        </p>
      ) : (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] leading-snug text-foreground">
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
