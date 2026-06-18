'use client';

import * as React from 'react';
import {
  CalendarDays,
  KanbanSquare,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Users2,
  Zap,
} from 'lucide-react';
import type { BoardDTO, ContactDTO, PipelineDTO } from '@/src/domain/crm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { CrmBoard } from '@/components/crm/crm-board';
import { CrmConfig } from '@/components/crm/crm-config';
import { CrmContacts } from '@/components/crm/crm-contacts';
import { CrmAutomations } from '@/components/crm/crm-automations';
import { CrmAgenda } from '@/components/crm/crm-agenda';
import { CrmAssistant } from '@/components/crm/crm-assistant';

const selectCls =
  'h-9 max-w-[min(45vw,14rem)] truncate rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Painel do CRM (visão principal full-width). Reúne o seletor de funis, o quadro
 * kanban, os contatos e o assistente de CRM. Carrega o board do funil ativo e a
 * lista de contatos, e recarrega quando algo muda (UI ou agente).
 */
export function CrmPanel() {
  const [pipelines, setPipelines] = React.useState<PipelineDTO[]>([]);
  const [pipelineId, setPipelineId] = React.useState<string | null>(null);
  const [board, setBoard] = React.useState<BoardDTO | null>(null);
  const [contatos, setContatos] = React.useState<ContactDTO[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState(false);
  const [boardErro, setBoardErro] = React.useState(false);
  const [configurando, setConfigurando] = React.useState(false);
  // Marca o pedido de board mais recente: ao trocar de funil rápido, respostas
  // chegam fora de ordem e uma antiga não pode sobrescrever o board atual.
  const boardReq = React.useRef(0);

  const carregarPipelines = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/crm/pipelines');
      if (!res.ok) return false;
      const data = (await res.json()) as { pipelines?: PipelineDTO[] };
      const lista = (data.pipelines ?? []).filter((p) => !p.arquivado);
      setPipelines(lista);
      // Mantém o funil ativo se ele ainda existe; senão cai no primeiro.
      setPipelineId((atual) =>
        atual && lista.some((p) => p.id === atual)
          ? atual
          : lista[0]?.id ?? null,
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const carregarBoard = React.useCallback(async (pid: string) => {
    const reqId = ++boardReq.current;
    try {
      const res = await fetch(`/api/crm/board?pipelineId=${pid}`);
      // Ignora respostas de pedidos superados por uma troca de funil.
      if (reqId !== boardReq.current) return;
      if (!res.ok) {
        setBoardErro(true);
        return;
      }
      const data = (await res.json()) as { board?: BoardDTO };
      if (reqId !== boardReq.current) return;
      setBoardErro(false);
      setBoard(data.board ?? null);
    } catch {
      if (reqId === boardReq.current) setBoardErro(true);
    }
  }, []);

  const carregarContatos = React.useCallback(async () => {
    try {
      const res = await fetch('/api/crm/contacts');
      if (!res.ok) return;
      const data = (await res.json()) as { contatos?: ContactDTO[] };
      setContatos(data.contatos ?? []);
    } catch {
      // silencioso — a aba de contatos cobre a ausência com o próprio vazio
    }
  }, []);

  const bootstrap = React.useCallback(async () => {
    setCarregando(true);
    setErro(false);
    // Os funis são a espinha do painel; se eles falham, é erro de tela cheia.
    const [okPipelines] = await Promise.all([
      carregarPipelines(),
      carregarContatos(),
    ]);
    setErro(!okPipelines);
    setCarregando(false);
  }, [carregarPipelines, carregarContatos]);

  // Bootstrap.
  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Recarrega o board quando o funil ativo muda. Zera antes para não mostrar o
  // board do funil anterior enquanto o novo carrega.
  React.useEffect(() => {
    setBoard(null);
    setBoardErro(false);
    if (pipelineId) void carregarBoard(pipelineId);
  }, [pipelineId, carregarBoard]);

  const recarregarTudo = React.useCallback(() => {
    if (pipelineId) void carregarBoard(pipelineId);
    void carregarContatos();
    void carregarPipelines();
  }, [pipelineId, carregarBoard, carregarContatos, carregarPipelines]);

  async function novoFunil() {
    const entrada = prompt('Nome do novo funil:')?.trim();
    if (!entrada) return;
    // Limita o tamanho para não enviar nomes patológicos à API / ao seletor.
    const nome = entrada.slice(0, 60);
    try {
      const res = await fetch('/api/crm/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        pipeline?: PipelineDTO;
        erro?: string;
      };
      if (!res.ok || !data.pipeline) {
        toast({ title: data.erro ?? 'Não foi possível criar o funil' });
        return;
      }
      await carregarPipelines();
      setPipelineId(data.pipeline.id);
      toast({ variant: 'success', title: 'Funil criado' });
    } catch {
      toast({ title: 'Não foi possível criar o funil' });
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-64 w-72" />
          <Skeleton className="h-64 w-72" />
          <Skeleton className="h-64 w-72" />
        </div>
      </div>
    );
  }

  if (erro) {
    return <CrmErro onRetry={() => void bootstrap()} />;
  }

  // Fallback das abas que dependem do board: erro recuperável (com retry) ou
  // carregamento transitório — nunca um "Carregando…" preso para sempre.
  const boardFallback = boardErro ? (
    <BoardErro
      onRetry={() => {
        if (pipelineId) void carregarBoard(pipelineId);
      }}
    />
  ) : (
    <p className="text-sm text-muted-foreground">Carregando funil…</p>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-foreground">CRM</h1>
          <p className="text-xs text-muted-foreground">
            Seu funil, do seu jeito — etapas, campos e cadastros que você ajusta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 0 ? (
            <select
              value={pipelineId ?? ''}
              onChange={(e) => setPipelineId(e.target.value)}
              className={selectCls}
              aria-label="Funil ativo"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void novoFunil()}>
            <Plus className="size-3.5" aria-hidden />
            Novo funil
          </Button>
        </div>
      </div>

      {pipelines.length === 0 ? (
        <CrmVazio onNovo={() => void novoFunil()} />
      ) : (
      <Tabs defaultValue="quadro" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="quadro" className="gap-1.5">
            <KanbanSquare className="size-3.5" aria-hidden />
            Quadro
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-1.5">
            <Users2 className="size-3.5" aria-hidden />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="gap-1.5">
            <Zap className="size-3.5" aria-hidden />
            Automações
          </TabsTrigger>
          <TabsTrigger value="assistente" className="gap-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            Assistente
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <TabsContent value="quadro" className="mt-0 flex min-h-0 flex-1 flex-col">
            {board ? (
              <CrmBoard
                board={board}
                contatos={contatos}
                onRefresh={recarregarTudo}
                onConfigurar={() => setConfigurando(true)}
              />
            ) : (
              boardFallback
            )}
          </TabsContent>

          <TabsContent value="contatos" className="mt-0 flex min-h-0 flex-1 flex-col">
            <CrmContacts contatos={contatos} onRefresh={carregarContatos} />
          </TabsContent>

          <TabsContent value="agenda" className="mt-0 flex min-h-0 flex-1 flex-col">
            {board ? (
              <CrmAgenda board={board} contatos={contatos} onRefresh={recarregarTudo} />
            ) : (
              boardFallback
            )}
          </TabsContent>

          <TabsContent value="automacoes" className="mt-0 flex min-h-0 flex-1 flex-col">
            {board ? (
              <CrmAutomations board={board} onRefresh={recarregarTudo} />
            ) : (
              boardFallback
            )}
          </TabsContent>

          <TabsContent value="assistente" className="mt-0 flex min-h-0 flex-1 flex-col">
            <CrmAssistant onChanged={recarregarTudo} />
          </TabsContent>
        </div>
      </Tabs>
      )}

      {configurando && board ? (
        <CrmConfig
          board={board}
          onClose={() => setConfigurando(false)}
          onRefresh={() => {
            if (pipelineId) void carregarBoard(pipelineId);
          }}
        />
      ) : null}
    </div>
  );
}

/** Falha ao carregar o painel inteiro (ex.: sem conexão). Oferece recomeçar. */
function CrmErro({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        aria-hidden
      >
        <TriangleAlert className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Não foi possível carregar o CRM
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Pode ter sido uma falha de conexão. Verifique sua internet e tente de
          novo.
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" aria-hidden />
        Tentar de novo
      </Button>
    </div>
  );
}

/** Nenhum funil ainda: convida a criar o primeiro. */
function CrmVazio({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <KanbanSquare className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Comece pelo seu primeiro funil
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Um funil organiza seus clientes por etapa — do primeiro contato ao
          fechamento. Crie um e ajuste as etapas do seu jeito.
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onNovo}>
        <Plus className="size-3.5" aria-hidden />
        Criar primeiro funil
      </Button>
    </div>
  );
}

/** Falha ao carregar só o board de um funil (recuperável, sem perder a tela). */
function BoardErro({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar este funil.
      </p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3.5" aria-hidden />
        Tentar de novo
      </Button>
    </div>
  );
}
