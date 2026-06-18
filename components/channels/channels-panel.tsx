'use client';

import * as React from 'react';
import { Inbox, Megaphone, Plug } from 'lucide-react';
import type { ChannelConnectionDTO, InboxItemDTO } from '@/src/domain/channels';
import type { SocialPostDTO } from '@/src/domain/social-posts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ChannelInbox } from '@/components/channels/channel-inbox';
import { ChannelConnections } from '@/components/channels/channel-connections';
import { ChannelPosts } from '@/components/channels/channel-posts';

/**
 * Painel de Canais (visão principal full-width). Reúne a caixa de entrada
 * unificada (WhatsApp, Instagram, Messenger) e as conexões de contas. Carrega o
 * inbox e as conexões, com poll leve para refletir novas mensagens.
 */
export function ChannelsPanel() {
  const [conversas, setConversas] = React.useState<InboxItemDTO[]>([]);
  const [conexoes, setConexoes] = React.useState<ChannelConnectionDTO[]>([]);
  const [posts, setPosts] = React.useState<SocialPostDTO[]>([]);
  const [configurado, setConfigurado] = React.useState(true);
  const [carregando, setCarregando] = React.useState(true);

  const carregar = React.useCallback(async () => {
    try {
      const [inboxRes, chRes, postsRes] = await Promise.all([
        fetch('/api/channels/inbox'),
        fetch('/api/channels'),
        fetch('/api/channels/posts'),
      ]);
      if (inboxRes.ok) {
        const data = (await inboxRes.json()) as { conversas?: InboxItemDTO[] };
        setConversas(data.conversas ?? []);
      }
      if (chRes.ok) {
        const data = (await chRes.json()) as {
          conexoes?: ChannelConnectionDTO[];
          configurado?: boolean;
        };
        setConexoes(data.conexoes ?? []);
        setConfigurado(data.configurado ?? false);
      }
      if (postsRes.ok) {
        const data = (await postsRes.json()) as { posts?: SocialPostDTO[] };
        setPosts(data.posts ?? []);
      }
    } catch {
      // silencioso
    }
  }, []);

  // Bootstrap + poll leve (8s) para novas mensagens recebidas.
  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      await carregar();
      if (vivo) setCarregando(false);
    })();
    const id = setInterval(() => void carregar(), 8000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [carregar]);

  // Lê o resultado do OAuth (?canais=...) que o callback adiciona à URL.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('canais');
    if (!status) return;
    if (status === 'conectado') {
      toast({ variant: 'success', title: 'Conta(s) conectada(s) com sucesso' });
    } else if (status === 'vazio') {
      toast({ title: 'Nenhuma conta encontrada para conectar' });
    } else if (status === 'erro') {
      toast({ title: 'Não foi possível concluir a conexão' });
    }
    // Limpa o parâmetro da URL sem recarregar.
    params.delete('canais');
    params.delete('n');
    const novo = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (novo ? `?${novo}` : ''),
    );
    void carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <div className="grid flex-1 grid-cols-[20rem_1fr] gap-3">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold text-foreground">Canais</h1>
        <p className="text-xs text-muted-foreground">
          Suas conversas de WhatsApp, Instagram e Messenger — e as publicações de Facebook e
          Instagram — num só lugar.
        </p>
      </div>

      <Tabs defaultValue="inbox" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="size-3.5" aria-hidden />
            Caixa de entrada
          </TabsTrigger>
          <TabsTrigger value="publicacoes" className="gap-1.5">
            <Megaphone className="size-3.5" aria-hidden />
            Publicações
          </TabsTrigger>
          <TabsTrigger value="conexoes" className="gap-1.5">
            <Plug className="size-3.5" aria-hidden />
            Conexões
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <TabsContent value="inbox" className="mt-0 flex min-h-0 flex-1 flex-col">
            <ChannelInbox conversas={conversas} onRefresh={carregar} />
          </TabsContent>

          <TabsContent value="publicacoes" className="mt-0 flex min-h-0 flex-1 flex-col">
            <ChannelPosts posts={posts} conexoes={conexoes} onRefresh={carregar} />
          </TabsContent>

          <TabsContent value="conexoes" className="mt-0 flex min-h-0 flex-1 flex-col">
            <ChannelConnections
              conexoes={conexoes}
              configurado={configurado}
              onRefresh={carregar}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
