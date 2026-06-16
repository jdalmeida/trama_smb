'use client';

import * as React from 'react';
import { CalendarDays, KanbanSquare, Plus, Users2, Sparkles, Zap } from 'lucide-react';
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
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

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
  const [configurando, setConfigurando] = React.useState(false);

  const carregarPipelines = React.useCallback(async () => {
    try {
      const res = await fetch('/api/crm/pipelines');
      if (!res.ok) return;
      const data = (await res.json()) as { pipelines?: PipelineDTO[] };
      const lista = (data.pipelines ?? []).filter((p) => !p.arquivado);
      setPipelines(lista);
      setPipelineId((atual) => atual ?? lista[0]?.id ?? null);
    } catch {
      // silencioso
    }
  }, []);

  const carregarBoard = React.useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/crm/board?pipelineId=${pid}`);
      if (!res.ok) return;
      const data = (await res.json()) as { board?: BoardDTO };
      setBoard(data.board ?? null);
    } catch {
      // silencioso
    }
  }, []);

  const carregarContatos = React.useCallback(async () => {
    try {
      const res = await fetch('/api/crm/contacts');
      if (!res.ok) return;
      const data = (await res.json()) as { contatos?: ContactDTO[] };
      setContatos(data.contatos ?? []);
    } catch {
      // silencioso
    }
  }, []);

  // Bootstrap.
  React.useEffect(() => {
    void (async () => {
      await Promise.all([carregarPipelines(), carregarContatos()]);
      setCarregando(false);
    })();
  }, [carregarPipelines, carregarContatos]);

  // Carrega o board sempre que o funil ativo muda.
  React.useEffect(() => {
    if (pipelineId) void carregarBoard(pipelineId);
  }, [pipelineId, carregarBoard]);

  const recarregarTudo = React.useCallback(() => {
    if (pipelineId) void carregarBoard(pipelineId);
    void carregarContatos();
    void carregarPipelines();
  }, [pipelineId, carregarBoard, carregarContatos, carregarPipelines]);

  async function novoFunil() {
    const nome = prompt('Nome do novo funil:')?.trim();
    if (!nome) return;
    try {
      const res = await fetch('/api/crm/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { pipeline: PipelineDTO };
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
              <p className="text-sm text-muted-foreground">Carregando funil…</p>
            )}
          </TabsContent>

          <TabsContent value="contatos" className="mt-0 flex min-h-0 flex-1 flex-col">
            <CrmContacts contatos={contatos} onRefresh={carregarContatos} />
          </TabsContent>

          <TabsContent value="agenda" className="mt-0 flex min-h-0 flex-1 flex-col">
            {board ? (
              <CrmAgenda board={board} contatos={contatos} onRefresh={recarregarTudo} />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
          </TabsContent>

          <TabsContent value="automacoes" className="mt-0 flex min-h-0 flex-1 flex-col">
            {board ? (
              <CrmAutomations board={board} onRefresh={recarregarTudo} />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
          </TabsContent>

          <TabsContent value="assistente" className="mt-0 flex min-h-0 flex-1 flex-col">
            <CrmAssistant onChanged={recarregarTudo} />
          </TabsContent>
        </div>
      </Tabs>

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
