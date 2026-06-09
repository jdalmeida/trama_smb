'use client';

import * as React from 'react';
import { Streamdown } from 'streamdown';
import type { DeliverableContent } from '@/src/domain/deliverable';

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
        <div className="space-y-3 text-xs text-stone-700">
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
    <div className="space-y-4 text-xs text-stone-700">
      <Secao titulo="Resumo">
        <Md>{content.resumo}</Md>
      </Secao>

      <Secao titulo="Posicionamento">
        <Md>{content.posicionamento}</Md>
      </Secao>

      {content.canais?.length ? (
        <Secao titulo="Canais priorizados">
          <ul className="space-y-2">
            {content.canais.map((c, i) => (
              <li key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {c.canal}
                  </span>
                  <Badge>{c.frequencia}</Badge>
                </div>
                <p className="mt-1 text-[var(--color-muted)]">{c.porque}</p>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {content.calendario?.length ? (
        <Secao titulo="Calendário inicial">
          <ul className="space-y-1.5">
            {content.calendario.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-black/5"
              >
                <span className="font-medium text-[var(--color-ink)]">
                  {item.dia}
                </span>
                <span className="text-[var(--color-muted)]">
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
        <Secao titulo="Ideias prontas para publicar">
          <div className="space-y-2">
            {content.ideiasProntas.map((ideia, i) => (
              <div key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {ideia.titulo}
                  </span>
                  <Badge>{ideia.canal}</Badge>
                </div>
                <div className="mt-1.5">
                  <Md>{ideia.texto}</Md>
                </div>
              </div>
            ))}
          </div>
        </Secao>
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
    <div className="space-y-4 text-xs text-stone-700">
      <Secao titulo="Panorama">
        <Md>{content.panorama}</Md>
      </Secao>

      {content.concorrentes?.length ? (
        <Secao titulo="Concorrentes">
          <div className="space-y-2">
            {content.concorrentes.map((c, i) => (
              <div key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <p className="font-semibold text-[var(--color-ink)]">{c.nome}</p>
                <p className="mt-0.5">{c.oQueFazem}</p>
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
                    className="mt-1.5 inline-block break-all text-[11px] text-[var(--color-brand)] underline"
                  >
                    {c.fonte}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {content.segmentos?.length ? (
        <Secao titulo="Segmentos de cliente">
          <div className="space-y-2">
            {content.segmentos.map((s, i) => (
              <div key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <p className="font-semibold text-[var(--color-ink)]">{s.nome}</p>
                <p className="mt-0.5">{s.descricao}</p>
                <p className="mt-1 text-[var(--color-muted)]">
                  Como alcançar: {s.comoAlcancar}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {content.sugestoesPosicionamento?.length ? (
        <Secao titulo="Sugestões de posicionamento">
          <ul className="ml-4 list-disc space-y-1">
            {content.sugestoesPosicionamento.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Secao>
      ) : null}
    </div>
  );
}

/* ---------------------------- Plano de prospecção ---------------------------- */

const PRIORIDADE_STYLE: Record<string, string> = {
  alta: 'bg-rose-100 text-rose-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-stone-100 text-stone-600',
};

const PRIORIDADE_LABEL: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

function PlanoProspeccaoView({
  content,
}: {
  content: Extract<DeliverableContent, { tipo: 'plano-prospeccao' }>;
}) {
  return (
    <div className="space-y-4 text-xs text-stone-700">
      <Secao titulo="Resumo">
        <Md>{content.resumo}</Md>
      </Secao>

      <Secao titulo="Critérios de priorização">
        <Md>{content.criteriosPriorizacao}</Md>
      </Secao>

      {content.oportunidades?.length ? (
        <Secao titulo="Oportunidades públicas">
          <div className="space-y-2">
            {content.oportunidades.map((o, i) => (
              <div key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {o.nome}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      PRIORIDADE_STYLE[o.prioridade] ?? PRIORIDADE_STYLE.baixa
                    }`}
                  >
                    {PRIORIDADE_LABEL[o.prioridade] ?? o.prioridade}
                  </span>
                </div>
                <p className="mt-0.5 text-[var(--color-muted)]">{o.tipo}</p>
                <p className="mt-1">{o.porQueVale}</p>
                <p className="mt-1">
                  <span className="font-medium text-[var(--color-ink)]">
                    Onde encontrar:
                  </span>{' '}
                  {o.ondeEncontrar}
                </p>
                <p className="mt-1">
                  <span className="font-medium text-[var(--color-ink)]">
                    Primeiro passo (você):
                  </span>{' '}
                  {o.primeiroPasso}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {content.roteirosAbordagem?.length ? (
        <Secao titulo="Roteiros de abordagem (uso pessoal do dono)">
          <div className="space-y-2">
            {content.roteirosAbordagem.map((r, i) => (
              <div key={i} className="rounded-lg border border-black/5 bg-white p-2.5">
                <p className="font-semibold text-[var(--color-ink)]">{r.situacao}</p>
                <div className="mt-1">
                  <Md>{r.roteiro}</Md>
                </div>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {content.avisosConformidade?.length ? (
        <Secao titulo="Conformidade (LGPD/CDC)">
          <ul className="ml-4 list-disc space-y-1 text-amber-800">
            {content.avisosConformidade.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Secao>
      ) : null}
    </div>
  );
}

/* --------------------------------- Auxiliares -------------------------------- */

/** Fallback genérico para tipo desconhecido: JSON formatado. */
function FallbackJson({ content }: { content: unknown }) {
  let json: string;
  try {
    json = JSON.stringify(content, null, 2);
  } catch {
    json = String(content);
  }
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-black/5 bg-white p-2.5 text-[11px] leading-snug text-stone-700">
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
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {titulo}
      </h4>
      {children}
    </section>
  );
}

function ListaRotulada({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  return (
    <div className="mt-1">
      <span className="font-medium text-[var(--color-ink)]">{rotulo}:</span>
      <ul className="ml-4 list-disc">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">
      {children}
    </span>
  );
}

/** Markdown estático (conteúdo já completo — sem streaming). */
function Md({ children }: { children: string }) {
  return (
    <Streamdown mode="static" className="space-y-1.5">
      {children}
    </Streamdown>
  );
}
