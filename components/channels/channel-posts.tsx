'use client';

import * as React from 'react';
import {
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ChannelConnectionDTO } from '@/src/domain/channels';
import {
  SOCIAL_POST_TARGETS,
  SOCIAL_POST_TARGET_LABELS,
  type SocialPostDTO,
  type SocialPostStatus,
  type SocialPostTarget,
} from '@/src/domain/social-posts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Aba "Publicações": fila de aprovação de posts para Facebook/Instagram.
 *
 * Os rascunhos chegam de dois jeitos: pela persona de Conteúdo & Aquisição (no
 * chat com o CEO, via tool criarRascunhoPost) ou criados aqui no composer. Em
 * ambos os casos o dono revisa a legenda, anexa a imagem, escolhe as redes e
 * APROVA — a IA nunca publica sozinha (guardrail).
 */
export function ChannelPosts({
  posts,
  conexoes,
  onRefresh,
}: {
  posts: SocialPostDTO[];
  conexoes: ChannelConnectionDTO[];
  onRefresh: () => void;
}) {
  const [selId, setSelId] = React.useState<string | null>(null);
  const [modoNovo, setModoNovo] = React.useState(false);

  // Estado de edição (legenda, imagem, redes).
  const [texto, setTexto] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [alvos, setAlvos] = React.useState<SocialPostTarget[]>([]);

  const [salvando, setSalvando] = React.useState(false);
  const [publicando, setPublicando] = React.useState(false);
  const [enviandoImg, setEnviandoImg] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const selecionado = React.useMemo(
    () => posts.find((p) => p.id === selId) ?? null,
    [posts, selId],
  );

  // Quais redes têm conta conectada (real ou de teste).
  const disponiveis = React.useMemo(() => {
    const set = new Set<SocialPostTarget>();
    for (const c of conexoes) {
      if (c.platform === 'messenger') set.add('facebook');
      if (c.platform === 'instagram') set.add('instagram');
    }
    return set;
  }, [conexoes]);

  const publicado = selecionado?.status === 'publicado';
  const editavel = (modoNovo || !!selecionado) && !publicado;

  function carregarNoEditor(post: SocialPostDTO) {
    setModoNovo(false);
    setSelId(post.id);
    setTexto(post.texto);
    setImageUrl(post.imageUrl);
    setAlvos(post.alvos.length ? post.alvos : sugerirAlvos(post.canalSugerido, disponiveis));
  }

  function novoPost() {
    setModoNovo(true);
    setSelId(null);
    setTexto('');
    setImageUrl(null);
    setAlvos([]);
  }

  function toggleAlvo(t: SocialPostTarget) {
    setAlvos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function subirImagem(file: File) {
    setEnviandoImg(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/channels/posts/upload', { method: 'POST', body: form });
      const data = (await res.json().catch(() => null)) as { url?: string; erro?: string } | null;
      if (!res.ok || !data?.url) throw new Error(data?.erro);
      setImageUrl(data.url);
    } catch (err) {
      toast({
        title:
          err instanceof Error && err.message
            ? err.message
            : 'Não foi possível enviar a imagem',
      });
    } finally {
      setEnviandoImg(false);
    }
  }

  /** Persiste o estado atual (cria se novo, senão atualiza) e devolve o DTO. */
  async function persistir(): Promise<SocialPostDTO | null> {
    if (!texto.trim()) {
      toast({ title: 'Escreva a legenda do post.' });
      return null;
    }
    if (modoNovo || !selecionado) {
      const res = await fetch('/api/channels/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), imageUrl: imageUrl ?? undefined, alvos }),
      });
      const data = (await res.json().catch(() => null)) as
        | { post?: SocialPostDTO; erro?: string }
        | null;
      if (!res.ok || !data?.post) throw new Error(data?.erro);
      return data.post;
    }
    const res = await fetch(`/api/channels/posts/${selecionado.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: texto.trim(), imageUrl, alvos }),
    });
    const data = (await res.json().catch(() => null)) as
      | { post?: SocialPostDTO; erro?: string }
      | null;
    if (!res.ok || !data?.post) throw new Error(data?.erro);
    return data.post;
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const post = await persistir();
      if (post) {
        carregarNoEditor(post);
        onRefresh();
        toast({ variant: 'success', title: 'Rascunho salvo' });
      }
    } catch (err) {
      toast({
        title: err instanceof Error && err.message ? err.message : 'Não foi possível salvar',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function publicar() {
    if (publicando) return;
    if (alvos.length === 0) {
      toast({ title: 'Escolha ao menos uma rede para publicar.' });
      return;
    }
    if (alvos.includes('instagram') && !imageUrl) {
      toast({ title: 'O Instagram exige uma imagem. Anexe uma antes de publicar.' });
      return;
    }
    setPublicando(true);
    try {
      const salvo = await persistir(); // garante id + últimos edits
      if (!salvo) return;
      const res = await fetch(`/api/channels/posts/${salvo.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alvos }),
      });
      const data = (await res.json().catch(() => null)) as
        | { post?: SocialPostDTO; erro?: string }
        | null;
      if (!res.ok || !data?.post) throw new Error(data?.erro);
      carregarNoEditor(data.post);
      onRefresh();
      const falhou = data.post.resultados.filter((r) => !r.ok);
      if (falhou.length === 0) {
        toast({ variant: 'success', title: 'Publicado!' });
      } else {
        toast({
          title: `Publicado com falha em ${falhou.length} rede(s). Veja os detalhes.`,
        });
      }
    } catch (err) {
      toast({
        title: err instanceof Error && err.message ? err.message : 'Não foi possível publicar',
      });
    } finally {
      setPublicando(false);
    }
  }

  async function descartar() {
    if (!selecionado) {
      novoPost();
      return;
    }
    if (!confirm('Descartar este rascunho?')) return;
    const res = await fetch(`/api/channels/posts/${selecionado.id}`, { method: 'DELETE' });
    if (res.ok) {
      setSelId(null);
      setModoNovo(false);
      onRefresh();
      toast({ title: 'Rascunho descartado' });
    } else {
      toast({ title: 'Não foi possível descartar' });
    }
  }

  const mostrarEditor = modoNovo || !!selecionado;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[20rem_1fr]">
      {/* Lista de posts */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Publicações</span>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={novoPost}>
            <Plus className="size-3.5" aria-hidden />
            Novo post
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Megaphone className="size-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Nenhuma publicação ainda. Peça posts ao CEO no chat (persona Conteúdo &
                Aquisição) ou crie um aqui.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {posts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => carregarNoEditor(p)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors',
                      selId === p.id ? 'bg-primary/10' : 'hover:bg-muted/60',
                    )}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="size-9 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Megaphone className="size-4" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-foreground">
                          {p.texto || '(sem legenda)'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        {p.origem === 'ia_sugestao' ? (
                          <span
                            className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                            title="Sugerido pela persona de Conteúdo & Aquisição"
                          >
                            <Sparkles className="size-3" aria-hidden />
                            IA
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor / aprovação */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        {mostrarEditor ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {publicado ? 'Publicação' : modoNovo || !selecionado ? 'Novo post' : 'Revisar rascunho'}
              </h2>
              {selecionado ? <StatusBadge status={selecionado.status} /> : null}
            </div>

            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva a legenda do post…"
              rows={6}
              disabled={!editavel}
              className="resize-none text-sm"
            />

            {/* Imagem */}
            <div className="flex flex-col gap-2">
              {imageUrl ? (
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Imagem do post"
                    className="max-h-56 rounded-lg border border-border object-contain"
                  />
                  {editavel ? (
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow ring-1 ring-border transition-colors hover:text-destructive"
                      aria-label="Remover imagem"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {editavel ? (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void subirImagem(f);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => fileRef.current?.click()}
                    disabled={enviandoImg}
                  >
                    <ImageIcon className="size-3.5" aria-hidden />
                    {enviandoImg ? 'Enviando…' : imageUrl ? 'Trocar imagem' : 'Anexar imagem'}
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Redes-alvo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Publicar em
              </span>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_POST_TARGETS.map((t) => {
                  const ativo = alvos.includes(t);
                  const temConta = disponiveis.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!editavel}
                      onClick={() => toggleAlvo(t)}
                      title={
                        temConta
                          ? undefined
                          : `Nenhuma conta de ${SOCIAL_POST_TARGET_LABELS[t]} conectada — conecte na aba Conexões (ou crie uma conta de teste).`
                      }
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                        ativo
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/60',
                        !editavel && 'opacity-60',
                      )}
                    >
                      {SOCIAL_POST_TARGET_LABELS[t]}
                      {!temConta ? <span className="text-[10px] opacity-70">(sem conta)</span> : null}
                    </button>
                  );
                })}
              </div>
              {alvos.includes('instagram') && !imageUrl ? (
                <p className="text-[11px] text-amber-600">
                  O Instagram exige uma imagem. Anexe uma antes de publicar.
                </p>
              ) : null}
            </div>

            {/* Resultados da publicação */}
            {selecionado?.resultados?.length ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resultado
                </span>
                {selecionado.resultados.map((r) => (
                  <div key={r.target} className="flex items-center gap-2 text-xs">
                    <Badge
                      variant={r.ok ? 'outline' : 'destructive'}
                      className={cn(r.ok && 'border-emerald-500/40 text-emerald-600')}
                    >
                      {SOCIAL_POST_TARGET_LABELS[r.target]}
                    </Badge>
                    {r.ok ? (
                      r.permalink ? (
                        <a
                          href={r.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary underline underline-offset-2"
                        >
                          Ver post <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Publicado</span>
                      )
                    ) : (
                      <span className="text-destructive">{r.erro ?? 'Falha'}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Ações */}
            {!publicado ? (
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => void descartar()}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Descartar
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void salvar()}
                    disabled={salvando || publicando || !texto.trim()}
                  >
                    <Save className="size-3.5" aria-hidden />
                    {salvando ? 'Salvando…' : 'Salvar rascunho'}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void publicar()}
                    disabled={publicando || salvando || !texto.trim() || alvos.length === 0}
                  >
                    <Send className="size-3.5" aria-hidden />
                    {publicando ? 'Publicando…' : 'Aprovar e publicar'}
                  </Button>
                </div>
              </div>
            ) : null}

            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 shrink-0" aria-hidden />
              A IA rascunha; você revisa, anexa a imagem, escolhe a rede e aprova. Nada vai ao ar
              sem o seu clique.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Megaphone className="size-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Selecione uma publicação para revisar, ou crie um novo post.
            </p>
            <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={novoPost}>
              <Plus className="size-3.5" aria-hidden />
              Novo post
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Auxiliares -------------------------------- */

const STATUS_UI: Record<
  SocialPostStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>['variant']; className?: string }
> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  publicando: { label: 'Publicando…', variant: 'outline', className: 'border-amber-500/40 text-amber-600' },
  publicado: { label: 'Publicado', variant: 'outline', className: 'border-emerald-500/40 text-emerald-600' },
  falha: { label: 'Falha', variant: 'destructive' },
};

function StatusBadge({ status }: { status: SocialPostStatus }) {
  const cfg = STATUS_UI[status];
  return (
    <Badge variant={cfg.variant} className={cn('text-[10px]', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

/** Pré-seleciona a rede a partir do canal sugerido pela IA, se houver conta. */
function sugerirAlvos(
  canalSugerido: string | null,
  disponiveis: Set<SocialPostTarget>,
): SocialPostTarget[] {
  if (!canalSugerido) return [];
  const c = canalSugerido.toLowerCase();
  const out: SocialPostTarget[] = [];
  if (c.includes('insta') && disponiveis.has('instagram')) out.push('instagram');
  if (c.includes('face') && disponiveis.has('facebook')) out.push('facebook');
  return out;
}
