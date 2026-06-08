'use client';

import * as React from 'react';
import { isToolUIPart, type UIMessage } from 'ai';
import type { BusinessProfile } from '@/src/domain/business-profile';
import { MessageParts } from '@/components/chat/message-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export interface ChatProps {
  messages: UIMessage[];
  sendMessage: (message: { text: string }) => Promise<void> | void;
  status: ChatStatus;
}

export function Chat({ messages, sendMessage, status }: ChatProps) {
  const [input, setInput] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const ocupado = status === 'submitted' || status === 'streaming';

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status]);

  const profile = React.useMemo(
    () => extrairUltimoPerfil(messages),
    [messages],
  );

  async function enviar() {
    const texto = input.trim();
    if (!texto || ocupado) return;
    setInput('');
    await sendMessage({ text: texto });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 ? (
          <EstadoVazio />
        ) : (
          messages.map((m) => <MessageParts key={m.id} message={m} />)
        )}

        {profile ? <ProfileCard profile={profile} /> : null}

        {status === 'submitted' ? (
          <p className="px-2 text-xs text-[var(--color-muted)]">Pensando…</p>
        ) : null}
        {status === 'error' ? (
          <p className="px-2 text-xs text-rose-600">
            Algo deu errado. Tente enviar novamente.
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-end gap-2 border-t border-black/5 pt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Conte sobre seu negócio ou peça uma tarefa ao time…"
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
        />
        <Button onClick={() => void enviar()} disabled={ocupado || !input.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}

function EstadoVazio() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-3xl">🧵</div>
      <h2 className="mt-3 text-base font-semibold text-[var(--color-ink)]">
        Vamos montar seu time
      </h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
        Conte sobre seu negócio: o que você vende, para quem e onde atua. A
        partir daí eu organizo o perfil e aciono os agentes certos.
      </p>
    </div>
  );
}

function ProfileCard({ profile }: { profile: BusinessProfile }) {
  const [estado, setEstado] = React.useState<
    'idle' | 'enviando' | 'ok' | 'erro'
  >('idle');

  async function confirmar() {
    setEstado('enviando');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, verified: true }),
      });
      setEstado(res.ok ? 'ok' : 'erro');
    } catch {
      setEstado('erro');
    }
  }

  return (
    <Card className="border-[var(--color-brand)]/30">
      <CardHeader>
        <CardTitle>Perfil do Negócio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Campo rotulo="Nome" valor={profile.nomeNegocio} />
        <Campo rotulo="Setor" valor={profile.setor} />
        <Campo rotulo="Produto / serviço" valor={profile.produtoServico} />
        <Campo rotulo="Público-alvo" valor={profile.publicoAlvo} />
        {profile.regiao ? <Campo rotulo="Região" valor={profile.regiao} /> : null}
        {profile.ticketMedio ? (
          <Campo rotulo="Ticket médio" valor={profile.ticketMedio} />
        ) : null}
        <CampoLista rotulo="Canais atuais" itens={profile.canaisAtuais} />
        <CampoLista rotulo="Principais dores" itens={profile.principaisDores} />
        <CampoLista rotulo="Diferenciais" itens={profile.diferenciais} />
        <CampoLista rotulo="Objetivos" itens={profile.objetivos} />

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={() => void confirmar()}
            disabled={estado === 'enviando' || estado === 'ok'}
          >
            {estado === 'ok' ? 'Perfil confirmado' : 'Confirmar perfil'}
          </Button>
          {estado === 'enviando' ? (
            <span className="text-xs text-[var(--color-muted)]">Salvando…</span>
          ) : null}
          {estado === 'erro' ? (
            <span className="text-xs text-rose-600">
              Não foi possível salvar. Tente de novo.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {rotulo}
      </p>
      <p className="text-[var(--color-ink)]">{valor}</p>
    </div>
  );
}

function CampoLista({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {rotulo}
      </p>
      <ul className="ml-4 list-disc text-[var(--color-ink)]">
        {itens.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Varre as mensagens em busca do output mais recente das tools
 * salvarPerfil / lerPerfil e devolve o BusinessProfile contido nele.
 */
function extrairUltimoPerfil(messages: UIMessage[]): BusinessProfile | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      if (!isToolUIPart(part)) continue;
      const nome = part.type.startsWith('tool-')
        ? part.type.slice('tool-'.length)
        : part.type;
      if (nome !== 'salvarPerfil' && nome !== 'lerPerfil') continue;
      if (part.state !== 'output-available') continue;
      const profile = extrairProfileDeOutput(
        'output' in part ? part.output : undefined,
      );
      if (profile) return profile;
    }
  }
  return null;
}

function extrairProfileDeOutput(output: unknown): BusinessProfile | null {
  if (typeof output !== 'object' || output === null) return null;
  const obj = output as Record<string, unknown>;
  // o output pode ser { profile: {...} } ou já ser o próprio profile
  const candidato =
    typeof obj.profile === 'object' && obj.profile !== null
      ? (obj.profile as Record<string, unknown>)
      : obj;
  if (typeof candidato.nomeNegocio === 'string') {
    return candidato as unknown as BusinessProfile;
  }
  return null;
}
