'use client';

import * as React from 'react';
import { Streamdown } from 'streamdown';
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { PersonaId } from '@/src/domain/persona';
import type { ArtifactAutor, ArtifactCategoria } from '@/src/db/schema';
import { PERSONAS } from '@/src/agents/registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface Artefato {
  id: string;
  titulo: string;
  categoria: ArtifactCategoria;
  autor: ArtifactAutor;
  tags: string[];
  conteudo: string;
  criadoEm: string;
}

const CATEGORIAS: { value: ArtifactCategoria; label: string; className: string }[] =
  [
    { value: 'nota', label: 'Nota', className: 'bg-muted text-muted-foreground' },
    {
      value: 'pesquisa',
      label: 'Pesquisa',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    },
    {
      value: 'decisao',
      label: 'Decisão',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    },
    {
      value: 'referencia',
      label: 'Referência',
      className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    },
  ];

function catCfg(c: ArtifactCategoria) {
  return CATEGORIAS.find((x) => x.value === c) ?? CATEGORIAS[0];
}

function nomeAutor(autor: ArtifactAutor): string {
  if (autor === 'ceo') return '🧑‍💼 CEO';
  if (autor === 'usuario') return 'Você';
  const persona = PERSONAS[autor as PersonaId];
  return persona ? `${persona.emoji} ${persona.nome}` : autor;
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Painel "Artefatos": a memória da empresa, agora editável. Lista, cria, edita,
 * apaga e melhora com IA os artefatos (notas, pesquisas, decisões, referências).
 * Substitui a antiga aba "Memória" (read-only e com overflow de texto).
 */
export function ArtifactsPanel() {
  const { artefatos, carregando, refresh } = useArtefatos();
  const [editando, setEditando] = React.useState<Artefato | null>(null);
  const [criando, setCriando] = React.useState(false);

  if (criando || editando) {
    return (
      <ArtifactEditor
        artefato={editando}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
        onSaved={() => {
          setCriando(false);
          setEditando(null);
          void refresh();
        }}
        onDeleted={() => {
          setEditando(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-foreground">Artefatos</h2>
          <p className="text-xs text-muted-foreground">
            A memória da empresa — notas, pesquisas, decisões e referências.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setCriando(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Novo
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {carregando && artefatos.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Carregando memória…
          </p>
        ) : artefatos.length === 0 ? (
          <EstadoVazio onNovo={() => setCriando(true)} />
        ) : (
          <ul className="flex flex-col gap-2 pr-1">
            {artefatos.map((a) => (
              <ArtefatoCard
                key={a.id}
                artefato={a}
                onEdit={() => setEditando(a)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

/** Cartão de artefato: cabeçalho + markdown com quebra de texto (sem overflow). */
function ArtefatoCard({
  artefato,
  onEdit,
}: {
  artefato: Artefato;
  onEdit: () => void;
}) {
  const [aberto, setAberto] = React.useState(false);
  const cfg = catCfg(artefato.categoria);

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex items-start gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
          aria-expanded={aberto}
        >
          <span className="flex w-full items-start justify-between gap-2">
            <span className="min-w-0 break-words text-sm font-semibold text-foreground">
              {artefato.titulo}
            </span>
            <Badge
              variant="secondary"
              className={cn('shrink-0', cfg.className)}
            >
              {cfg.label}
            </Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>{nomeAutor(artefato.autor)}</span>
            <span aria-hidden>·</span>
            <span>{formatarData(artefato.criadoEm)}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Editar artefato"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {aberto ? (
        <div className="flex flex-col gap-2 border-t p-3 animate-in fade-in duration-200">
          {artefato.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {artefato.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] text-muted-foreground"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="min-w-0 break-words [overflow-wrap:anywhere]">
            <Streamdown mode="static" className="flex flex-col gap-1.5 text-sm">
              {artefato.conteudo}
            </Streamdown>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Editor de artefato: criar/editar + melhorar com IA (preview antes/depois). */
function ArtifactEditor({
  artefato,
  onClose,
  onSaved,
  onDeleted,
}: {
  artefato: Artefato | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [titulo, setTitulo] = React.useState(artefato?.titulo ?? '');
  const [categoria, setCategoria] = React.useState<ArtifactCategoria>(
    artefato?.categoria ?? 'nota',
  );
  const [tags, setTags] = React.useState((artefato?.tags ?? []).join(', '));
  const [conteudo, setConteudo] = React.useState(artefato?.conteudo ?? '');
  const [salvando, setSalvando] = React.useState(false);

  // Estado da melhoria com IA.
  const [sugestao, setSugestao] = React.useState<string | null>(null);
  const [melhorando, setMelhorando] = React.useState(false);

  const editando = artefato !== null;

  async function salvar() {
    const t = titulo.trim();
    if (!t) {
      toast({ title: 'Dê um título ao artefato' });
      return;
    }
    setSalvando(true);
    const corpo = {
      titulo: t,
      categoria,
      conteudo,
      tags: tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const res = editando
        ? await fetch(`/api/artifacts/${artefato.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          })
        : await fetch('/api/artifacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
          });
      if (!res.ok) throw new Error();
      toast({ variant: 'success', title: 'Artefato salvo' });
      onSaved();
    } catch {
      toast({ title: 'Não foi possível salvar' });
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!editando) return;
    if (!confirm('Apagar este artefato?')) return;
    try {
      const res = await fetch(`/api/artifacts/${artefato.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Artefato apagado' });
      onDeleted();
    } catch {
      toast({ title: 'Não foi possível apagar' });
    }
  }

  async function melhorar() {
    if (!conteudo.trim()) {
      toast({ title: 'Escreva algo antes de melhorar' });
      return;
    }
    setMelhorando(true);
    setSugestao('');
    try {
      const res = await fetch('/api/artifacts/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, categoria, conteudo }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setSugestao(acc);
      }
    } catch {
      toast({ title: 'A melhoria com IA falhou' });
      setSugestao(null);
    } finally {
      setMelhorando(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onClose}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {editando ? 'Editar artefato' : 'Novo artefato'}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 pr-1">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            aria-label="Título"
          />

          <div className="flex flex-wrap gap-1">
            {CATEGORIAS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoria(c.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  categoria === c.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separadas por vírgula)"
            aria-label="Tags"
          />

          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Conteúdo em Markdown…"
            className="min-h-40 resize-y font-mono text-xs leading-relaxed"
            aria-label="Conteúdo"
          />

          {sugestao !== null ? (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.03] p-2.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden />
                Sugestão da IA
                {melhorando ? (
                  <span className="font-normal text-muted-foreground">
                    gerando…
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                <Streamdown className="flex flex-col gap-1.5 text-xs">
                  {sugestao}
                </Streamdown>
              </div>
              {!melhorando ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => {
                      setConteudo(sugestao);
                      setSugestao(null);
                      toast({ title: 'Sugestão aplicada' });
                    }}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Aceitar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setSugestao(null)}
                  >
                    <X className="size-3.5" aria-hidden />
                    Descartar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void melhorar()}
          disabled={melhorando}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {melhorando ? 'Melhorando…' : 'Melhorar com IA'}
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
      </div>
    </div>
  );
}

function useArtefatos(): {
  artefatos: Artefato[];
  carregando: boolean;
  refresh: () => Promise<void>;
} {
  const [artefatos, setArtefatos] = React.useState<Artefato[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/artifacts');
      if (!res.ok) return;
      const data = (await res.json()) as { artefatos?: Artefato[] };
      setArtefatos(data.artefatos ?? []);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  return { artefatos, carregando, refresh };
}

function EstadoVazio({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <Sparkles className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          A memória ainda está vazia
        </p>
        <p className="text-xs text-muted-foreground">
          Crie um artefato ou deixe o time alimentar com notas, pesquisas e
          decisões.
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onNovo}>
        <Plus className="size-3.5" aria-hidden />
        Criar artefato
      </Button>
    </div>
  );
}
