'use client';

import * as React from 'react';
import { isToolUIPart, type UIMessage } from 'ai';
import type { BusinessProfile } from '@/src/domain/business-profile';
import { MessageParts } from '@/components/chat/message-parts';
import { ProfileFields } from '@/components/profile/profile-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { SendIcon, type SendIconHandle } from '@/components/ui/send';
import { LoaderIcon, type LoaderIconHandle } from '@/components/ui/loader';
import { SparklesIcon } from '@/components/ui/sparkles';

type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export interface ChatProps {
  messages: UIMessage[];
  sendMessage: (message: { text: string }) => Promise<void> | void;
  status: ChatStatus;
  /** True enquanto o histórico persistido ainda está sendo carregado. */
  carregandoHistorico?: boolean;
  /**
   * Se o Perfil do Negócio já foi confirmado pelo dono. Quando `true`, o card
   * de confirmação não aparece no chat (o perfil vive na aba "Memórias"); só
   * surge enquanto está `false` (onboarding ou reconfirmação após edição).
   */
  perfilVerificado?: boolean | null;
  /** Confirma o perfil extraído na conversa (marca como verificado). */
  onConfirmarPerfil?: (profile: BusinessProfile) => Promise<void> | void;
}

export function Chat({
  messages,
  sendMessage,
  status,
  carregandoHistorico = false,
  perfilVerificado = null,
  onConfirmarPerfil,
}: ChatProps) {
  const [input, setInput] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const sendIconRef = React.useRef<SendIconHandle | null>(null);

  const ocupado =
    status === 'submitted' || status === 'streaming' || carregandoHistorico;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, status]);

  const profile = React.useMemo(
    () => extrairUltimoPerfil(messages),
    [messages],
  );

  // O card de confirmação só aparece enquanto o perfil não foi verificado.
  // Depois de confirmado ele vive na aba "Memórias" — não polui mais o chat.
  const mostrarPerfil = profile !== null && perfilVerificado === false;

  async function enviar() {
    const texto = input.trim();
    if (!texto || ocupado) return;
    setInput('');
    sendIconRef.current?.startAnimation();
    window.setTimeout(() => sendIconRef.current?.stopAnimation(), 800);
    await sendMessage({ text: texto });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  function usarSugestao(texto: string) {
    setInput(texto);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 ? (
          carregandoHistorico ? (
            <CarregandoConversa />
          ) : (
            <EstadoVazio onSugestao={usarSugestao} />
          )
        ) : (
          messages.map((m) => <MessageParts key={m.id} message={m} />)
        )}

        {mostrarPerfil ? (
          <ProfileCard profile={profile} onConfirmar={onConfirmarPerfil} />
        ) : null}

        {status === 'submitted' ? <IndicadorPensando /> : null}
        {status === 'error' ? (
          <p className="px-2 text-xs text-destructive">
            Não consegui enviar sua mensagem. Verifique sua conexão e tente de
            novo.
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Conte sobre seu negócio ou peça uma tarefa ao time…"
          className="max-h-40 min-h-11 flex-1 resize-none"
          aria-label="Mensagem para o CEO"
        />
        <Button
          size="icon-lg"
          onClick={() => void enviar()}
          disabled={ocupado || !input.trim()}
          aria-label="Enviar mensagem"
        >
          <SendIcon ref={sendIconRef} size={16} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Skeleton exibido enquanto o histórico do chat é carregado. */
function CarregandoConversa() {
  return (
    <div className="space-y-4 px-1 py-2" aria-label="Carregando conversa">
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-52 rounded-2xl" />
      </div>
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-60 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Indicador de "pensando" enquanto o CEO prepara a resposta. */
function IndicadorPensando() {
  const loaderRef = React.useRef<LoaderIconHandle | null>(null);

  React.useEffect(() => {
    loaderRef.current?.startAnimation();
    return () => loaderRef.current?.stopAnimation();
  }, []);

  return (
    <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground animate-in fade-in duration-300">
      <LoaderIcon ref={loaderRef} size={14} aria-hidden />
      <span>Pensando…</span>
    </div>
  );
}

const SUGESTOES = [
  'Tenho uma loja de roupas em Curitiba',
  'Quero entender meu mercado',
  'Preciso de clientes novos',
];

function EstadoVazio({ onSugestao }: { onSugestao: (texto: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <SparklesIcon size={24} aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">
        Vamos montar seu time
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Conte sobre seu negócio: o que você vende, para quem e onde atua. A
        partir daí eu organizo o perfil e aciono os agentes certos.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {SUGESTOES.map((sugestao) => (
          <Button
            key={sugestao}
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => onSugestao(sugestao)}
          >
            {sugestao}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onConfirmar,
}: {
  profile: BusinessProfile;
  onConfirmar?: (profile: BusinessProfile) => Promise<void> | void;
}) {
  const [estado, setEstado] = React.useState<'idle' | 'enviando' | 'erro'>(
    'idle',
  );

  async function confirmar() {
    setEstado('enviando');
    try {
      await onConfirmar?.(profile);
      // Em caso de sucesso o perfil vira "verificado" e este card desmonta;
      // não precisamos de um estado "ok" — o card simplesmente desaparece.
    } catch {
      setEstado('erro');
    }
  }

  return (
    <Card className="ring-primary/30 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <CardTitle>Perfil do Negócio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ProfileFields profile={profile} />

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={() => void confirmar()}
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Salvando…' : 'Confirmar perfil'}
          </Button>
          {estado === 'erro' ? (
            <span className="text-xs text-destructive">
              Não foi possível salvar. Tente de novo.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
  // o output pode ser { perfil: {...} } (salvarPerfil), { profile: {...} },
  // ou já ser o próprio profile (lerPerfil retorna o objeto direto).
  const aninhado =
    (typeof obj.perfil === 'object' && obj.perfil !== null && obj.perfil) ||
    (typeof obj.profile === 'object' && obj.profile !== null && obj.profile);
  const candidato = (aninhado || obj) as Record<string, unknown>;
  if (typeof candidato.nomeNegocio === 'string') {
    return candidato as unknown as BusinessProfile;
  }
  return null;
}
