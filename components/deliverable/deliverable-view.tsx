'use client';

import * as React from 'react';
import { Streamdown } from 'streamdown';
import { Megaphone, ShieldCheck } from 'lucide-react';
import type { DeliverableContent } from '@/src/domain/deliverable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

/**
 * Visão completa de um entregável, por tipo (discriminated union).
 * Campos de texto longos são renderizados como markdown (streamdown);
 * tipos desconhecidos caem num fallback de JSON formatado.
 */
export interface DeliverableViewProps {
  content: DeliverableContent;
}

export function DeliverableView({ content }: DeliverableViewProps) {
  switch (content.tipo) {
    case 'plano-conteudo':
      return <PlanoConteudoView content={content} />;
    case 'pesquisa-mercado':
      return <PesquisaMercadoView content={content} />;
    case 'plano-prospeccao':
      return <PlanoProspeccaoView content={content} />;
    case 'texto':
      return (
        <div className="flex flex-col gap-3 text-xs text-foreground">
          <Md>{content.texto}</Md>
        </div>
      );
    default:
      return <FallbackJson content={content} />;
  }
}

/* ----------------------------- Plano de conteúdo ----------------------------- */

function PlanoConteudoView({
  content,
}: {
  content: Extract<DeliverableContent, { tipo: 'plano-conteudo' }>;
}) {
  return (
    <div className="flex flex-col gap-4 text-xs text-foreground">
      <Secao titulo="Resumo">
        <Md>{content.resumo}</Md>
      </Secao>

      <Secao titulo="Posicionamento">
        <Md>{content.posicionamento}</Md>
      </Secao>

      {content.canais?.length ? (
        <>
          <Separator />
          <Secao titulo="Canais priorizados">
            <ul className="flex flex-col gap-2">
              {content.canais.map((c, i) => (
                <li key={i} className="rounded-lg border bg-card p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{c.canal}</span>
                    <Badge variant="secondary">{c.frequencia}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.porque}</p>
                </li>
              ))}
            </ul>
          </Secao>
        </>
      ) : null}

      {content.calendario?.length ? (
        <Secao titulo="Calendário inicial">
          <ul className="flex flex-col gap-1.5">
            {content.calendario.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2 rounded-md border bg-card px-2.5 py-1.5"
              >
                <span className="font-medium">{item.dia}</span>
                <span className="text-muted-foreground">
                  {item.canal} · {item.formato}
                </span>
                <span className="basis-full">
                  <span className="font-medium">{item.tema}</span> — {item.gancho}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {content.ideiasProntas?.length ? (
        <>
          <Separator />
          <Secao titulo="Ideias prontas para publicar">
            <Accordion type="multiple" className="rounded-lg border bg-card px-2.5">
              {content.ideiasProntas.map((ideia, i) => (
                <AccordionItem key={i} value={`ideia-${i}`}>
                  <AccordionTrigger className="text-xs">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
                      <span className="truncate font-semibold">
                        {ideia.titulo}
                      </span>
                      <Badge variant="secondary">{ideia.canal}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs">
                    <Md>{ideia.texto}</Md>
                    <EnviarParaPublicacoes canal={ideia.canal} texto={ideia.texto} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Secao>
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------- Pesquisa de mercado ---------------------------- */

function PesquisaMercadoView({
  content,
}: {
  content: Extract<DeliverableContent, { tipo: 'pesquisa-mercado' }>;
}) {
  return (
    <div className="flex flex-col gap-4 text-xs text-foreground">
      <Secao titulo="Panorama">
        <Md>{content.panorama}</Md>
      </Secao>

      {content.concorrentes?.length ? (
        <>
          <Separator />
          <Secao titulo="Concorrentes">
            <div className="flex flex-col gap-2">
              {content.concorrentes.map((c, i) => (
                <Card key={i} size="sm" className="gap-1.5">
                  <CardHeader>
                    <CardTitle className="text-xs">{c.nome}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5 text-xs">
                    <p>{c.oQueFazem}</p>
                    {c.forcas?.length ? (
                      <ListaRotulada rotulo="Forças" itens={c.forcas} />
                    ) : null}
                    {c.brechas?.length ? (
                      <ListaRotulada rotulo="Brechas" itens={c.brechas} />
                    ) : null}
                    {c.fonte ? (
                      <a
                        href={c.fonte}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-[11px] text-primary underline underline-offset-2"
                      >
                        {c.fonte}
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </Secao>
        </>
      ) : null}

      {content.segmentos?.length ? (
        <Secao titulo="Segmentos de cliente">
          <div className="flex flex-col gap-2">
            {content.segmentos.map((s, i) => (
              <Card key={i} size="sm" className="gap-1.5">
                <CardHeader>
                  <CardTitle className="text-xs">{s.nome}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-xs">
                  <p>{s.descricao}</p>
                  <p className="text-muted-foreground">
                    Como alcançar: {s.comoAlcancar}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Secao>
      ) : null}

      {content.sugestoesPosicionamento?.length ? (
        <>
          <Separator />
          <Secao titulo="Sugestões de posicionamento">
            <ul className="ml-4 flex list-disc flex-col gap-1">
              {content.sugestoesPosicionamento.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Secao>
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------- Plano de prospecção ---------------------------- */

const PRIORIDADE: Record<
  string,
  {
    label: string;
    variant: React.ComponentProps<typeof Badge>['variant'];
    className?: string;
  }
> = {
  alta: { label: 'Alta', variant: 'destructive' },
  media: {
    label: 'Média',
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-700',
  },
  baixa: { label: 'Baixa', variant: 'outline', className: 'text-muted-foreground' },
};

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const cfg = PRIORIDADE[prioridade] ?? {
    label: prioridade,
    variant: 'outline' as const,
  };
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function PlanoProspeccaoView({
  content,
}: {
  content: Extract<DeliverableContent, { tipo: 'plano-prospeccao' }>;
}) {
  return (
    <div className="flex flex-col gap-4 text-xs text-foreground">
      <Secao titulo="Resumo">
        <Md>{content.resumo}</Md>
      </Secao>

      <Secao titulo="Critérios de priorização">
        <Md>{content.criteriosPriorizacao}</Md>
      </Secao>

      {content.oportunidades?.length ? (
        <>
          <Separator />
          <Secao titulo="Oportunidades públicas">
            <div className="flex flex-col gap-2">
              {content.oportunidades.map((o, i) => (
                <Card key={i} size="sm" className="gap-1.5">
                  <CardHeader>
                    <CardTitle className="text-xs">{o.nome}</CardTitle>
                    <CardAction>
                      <PrioridadeBadge prioridade={o.prioridade} />
                    </CardAction>
                    <CardDescription className="text-xs">
                      {o.tipo}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5 text-xs">
                    <p>{o.porQueVale}</p>
                    <p>
                      <span className="font-medium">Onde encontrar:</span>{' '}
                      {o.ondeEncontrar}
                    </p>
                    <p>
                      <span className="font-medium">Primeiro passo (você):</span>{' '}
                      {o.primeiroPasso}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Secao>
        </>
      ) : null}

      {content.roteirosAbordagem?.length ? (
        <Secao titulo="Roteiros de abordagem (uso pessoal do dono)">
          <Accordion type="multiple" className="rounded-lg border bg-card px-2.5">
            {content.roteirosAbordagem.map((r, i) => (
              <AccordionItem key={i} value={`roteiro-${i}`}>
                <AccordionTrigger className="text-xs font-semibold">
                  {r.situacao}
                </AccordionTrigger>
                <AccordionContent className="text-xs">
                  <Md>{r.roteiro}</Md>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Secao>
      ) : null}

      {content.avisosConformidade?.length ? (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-amber-600"
            aria-hidden
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold text-amber-800">
              Conformidade (LGPD/CDC)
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-1 text-amber-800">
              {content.avisosConformidade.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- Auxiliares -------------------------------- */

/**
 * Envia uma ideia pronta para a fila de Publicações (Canais › Publicações) como
 * rascunho. É o caminho determinístico que complementa a tool da persona: mesmo
 * planos antigos podem ser empurrados para a fila com um clique. O dono revisa,
 * anexa a imagem, escolhe a rede e publica — nada vai ao ar sem aprovação.
 */
function EnviarParaPublicacoes({ canal, texto }: { canal: string; texto: string }) {
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);

  async function enviar() {
    if (enviando || enviado) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/channels/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, canalSugerido: canal, origem: 'ia_sugestao' }),
      });
      if (!res.ok) throw new Error();
      setEnviado(true);
      toast({
        variant: 'success',
        title: 'Enviado para Publicações',
        description: 'Revise, anexe a imagem e publique em Canais › Publicações.',
      });
    } catch {
      toast({ title: 'Não foi possível enviar para Publicações' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 h-7 gap-1.5 text-[11px]"
      onClick={() => void enviar()}
      disabled={enviando || enviado}
    >
      <Megaphone className="size-3.5" aria-hidden />
      {enviado ? 'Enviado para Publicações' : enviando ? 'Enviando…' : 'Enviar para Publicações'}
    </Button>
  );
}

/** Fallback genérico para tipo desconhecido: JSON formatado. */
function FallbackJson({ content }: { content: unknown }) {
  let json: string;
  try {
    json = JSON.stringify(content, null, 2);
  } catch {
    json = String(content);
  }
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-2.5 text-[11px] leading-snug text-foreground">
      {json}
    </pre>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h4>
      {children}
    </section>
  );
}

function ListaRotulada({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  return (
    <div>
      <span className="font-medium">{rotulo}:</span>
      <ul className="ml-4 list-disc">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Markdown estático (conteúdo já completo — sem streaming). */
function Md({ children }: { children: string }) {
  return (
    <Streamdown mode="static" className="flex flex-col gap-1.5">
      {children}
    </Streamdown>
  );
}
