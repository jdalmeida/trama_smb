'use client';

import * as React from 'react';
import { Plug, Trash2, FlaskConical } from 'lucide-react';
import {
  CHANNEL_PLATFORMS,
  type ChannelConnectionDTO,
  type ChannelPlatform,
} from '@/src/domain/channels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { PLATFORM_UI, PlatformBadge } from '@/components/channels/platform';
import { WhatsAppConnect } from '@/components/channels/whatsapp-connect';

/**
 * Aba "Conexões": uma seção por plataforma (WhatsApp, Instagram, Messenger) com
 * as contas conectadas e os botões de conectar/desconectar. Quando a integração
 * Meta não está configurada, oferece uma "conta de teste" (modo de simulação).
 */
export function ChannelConnections({
  conexoes,
  configurado,
  onRefresh,
}: {
  conexoes: ChannelConnectionDTO[];
  configurado: boolean;
  onRefresh: () => void;
}) {
  const porPlataforma = React.useMemo(() => {
    const m: Record<ChannelPlatform, ChannelConnectionDTO[]> = {
      whatsapp: [],
      instagram: [],
      messenger: [],
    };
    for (const c of conexoes) m[c.platform].push(c);
    return m;
  }, [conexoes]);

  function conectar(platform: ChannelPlatform) {
    // Redireciona para o OAuth da Meta (a rota cuida do state assinado).
    window.location.href = `/api/channels/connect?platform=${platform}`;
  }

  async function contaTeste(platform: ChannelPlatform) {
    try {
      const res = await fetch('/api/channels/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) throw new Error();
      toast({ variant: 'success', title: `Conta de teste de ${PLATFORM_UI[platform].label} criada` });
      onRefresh();
    } catch {
      toast({ title: 'Não foi possível criar a conta de teste' });
    }
  }

  async function desconectar(c: ChannelConnectionDTO) {
    if (!confirm(`Desconectar "${c.nomeExibicao}"? As conversas dessa conta serão removidas.`)) {
      return;
    }
    const res = await fetch(`/api/channels/${c.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Conta desconectada' });
      onRefresh();
    } else {
      toast({ title: 'Não foi possível desconectar' });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {!configurado ? (
        <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Integração Meta ainda não configurada</p>
          <p className="mt-1 text-muted-foreground">
            Para conectar contas reais de WhatsApp, Instagram e Messenger, configure o app na Meta
            (veja <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/omnichannel-setup.md</code>).
            Enquanto isso, crie uma <strong>conta de teste</strong> para experimentar a caixa de entrada.
          </p>
        </div>
      ) : null}

      {CHANNEL_PLATFORMS.map((platform) => {
        const { label } = PLATFORM_UI[platform];
        const contas = porPlataforma[platform];
        return (
          <section
            key={platform}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <PlatformBadge platform={platform} />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {contas.length === 0
                      ? 'Nenhuma conta conectada'
                      : `${contas.length} conta(s) conectada(s)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void contaTeste(platform)}
                >
                  <FlaskConical className="size-3.5" aria-hidden />
                  Conta de teste
                </Button>
                {platform === 'whatsapp' ? (
                  <WhatsAppConnect onRefresh={onRefresh} />
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!configurado}
                    onClick={() => conectar(platform)}
                    title={configurado ? undefined : 'Configure a integração Meta para conectar'}
                  >
                    <Plug className="size-3.5" aria-hidden />
                    Conectar
                  </Button>
                )}
              </div>
            </div>

            {platform === 'whatsapp' ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Conectado em <strong>coexistência</strong>: você segue usando o app WhatsApp
                Business no celular e o Trama recebe as conversas em paralelo (inclusive o que
                você responde pelo app e o histórico recente).
              </p>
            ) : null}

            {contas.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {contas.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-foreground">{c.nomeExibicao}</span>
                      {c.coexistence ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 text-[10px] text-emerald-600"
                          title="O número roda ao mesmo tempo no app WhatsApp Business e na Cloud API"
                        >
                          coexistência
                        </Badge>
                      ) : null}
                      {c.simulada ? (
                        <Badge variant="secondary" className="text-[10px]">
                          teste
                        </Badge>
                      ) : (
                        <Badge
                          variant={c.status === 'conectado' ? 'outline' : 'destructive'}
                          className="text-[10px]"
                        >
                          {c.status}
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void desconectar(c)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Desconectar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
