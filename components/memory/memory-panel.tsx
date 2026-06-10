'use client';

import * as React from 'react';
import { Streamdown } from 'streamdown';
import type { PersonaId } from '@/src/domain/persona';
import type { ArtifactAutor, ArtifactCategoria } from '@/src/db/schema';
import { PERSONAS } from '@/src/agents/registry';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FileTextIcon,
  type FileTextIconHandle,
} from '@/components/ui/file-text';
import { cn } from '@/lib/utils';

/** Artefato como vem de GET /api/artifacts (conteúdo completo). */
interface Artefato {
  id: string;
  titulo: string;
  categoria: ArtifactCategoria;
  autor: ArtifactAutor;
  tags: string[];
  conteudo: string;
  criadoEm: string;
}

/** Rótulo e cor semântica discreta por categoria de artefato. */
const CATEGORIA: Record<
  ArtifactCategoria,
  { label: string; className: string }
> = {
  nota: { label: 'Nota', className: 'bg-muted text-muted-foreground' },
  pesquisa: {
    label: 'Pesquisa',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  decisao: {
    label: 'Decisão',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  referencia: {
    label: 'Referência',
    className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
};

/** Nome amigável do autor do artefato (CEO, dono ou persona do registry). */
function nomeAutor(autor: ArtifactAutor): string {
  if (autor === 'ceo') return '🧑‍💼 CEO';
  if (autor === 'usuario') return 'Você';
  const persona = PERSONAS[autor as PersonaId];
  return persona ? `${persona.emoji} ${persona.nome}` : autor;
}

/** Data curta em pt-BR (ex.: "9 de jun., 14:32"). */
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
 * Painel "Memória": lista os artefatos da memória da empresa (notas, achados
 * de pesquisa, decisões e referências que o CEO e o time vão acumulando).
 * Busca em GET /api/artifacts na montagem + poll leve a cada 15s.
 */
export function MemoryPanel() {
  const { artefatos, carregando } = useArtefatos();

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Memória</h2>
        <span className="text-xs text-muted-foreground">
          {artefatos.length === 1
            ? '1 artefato'
            : `${artefatos.length} artefatos`}
        </span>
      </div>

      {carregando && artefatos.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Carregando memória…
        </p>
      ) : artefatos.length === 0 ? (
        <EstadoVazio />
      ) : (
        <Accordion
          type="multiple"
          className="rounded-xl border bg-card px-3 animate-in fade-in duration-300"
        >
          {artefatos.map((artefato) => (
            <ArtefatoItem key={artefato.id} artefato={artefato} />
          ))}
        </Accordion>
      )}
    </aside>
  );
}

/**
 * Busca os artefatos em GET /api/artifacts (na montagem + poll leve a cada
 * 15s), no mesmo espírito do useApiRuns do console.
 */
function useArtefatos(): { artefatos: Artefato[]; carregando: boolean } {
  const [artefatos, setArtefatos] = React.useState<Artefato[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const res = await fetch('/api/artifacts');
        if (!res.ok) return;
        const data = (await res.json()) as { artefatos?: Artefato[] };
        if (!vivo) return;
        setArtefatos(data.artefatos ?? []);
      } catch {
        // silencioso — o painel mantém o que já tem
      } finally {
        if (vivo) setCarregando(false);
      }
    };
    void carregar();
    const id = setInterval(() => void carregar(), 15000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return { artefatos, carregando };
}

/** Um artefato na lista: cabeçalho rico no trigger + markdown no conteúdo. */
function ArtefatoItem({ artefato }: { artefato: Artefato }) {
  const categoria = CATEGORIA[artefato.categoria] ?? CATEGORIA.nota;

  return (
    <AccordionItem value={artefato.id}>
      <AccordionTrigger className="text-xs">
        <span className="flex min-w-0 flex-1 flex-col gap-1 pr-2 text-left">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-foreground">
              {artefato.titulo}
            </span>
            <Badge
              variant="secondary"
              className={cn('shrink-0', categoria.className)}
            >
              {categoria.label}
            </Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-normal text-muted-foreground">
            <span>{nomeAutor(artefato.autor)}</span>
            <span aria-hidden>·</span>
            <span>{formatarData(artefato.criadoEm)}</span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="text-xs">
        <div className="flex flex-col gap-2">
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
          <Streamdown mode="static" className="flex flex-col gap-1.5">
            {artefato.conteudo}
          </Streamdown>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/** Estado vazio: a memória ainda não foi alimentada pelo time. */
function EstadoVazio() {
  const iconRef = React.useRef<FileTextIconHandle>(null);

  React.useEffect(() => {
    const t = setTimeout(() => iconRef.current?.startAnimation(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center animate-in fade-in zoom-in-95 duration-500"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <FileTextIcon ref={iconRef} size={24} className="flex" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          A memória ainda está vazia
        </p>
        <p className="text-xs text-muted-foreground">
          Conforme o CEO e o time trabalham, notas, pesquisas e decisões
          aparecem aqui.
        </p>
      </div>
    </div>
  );
}
