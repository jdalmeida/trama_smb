'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';

import {
  CircleCheckIcon,
  type CircleCheckIconHandle,
} from '@/components/ui/circle-check';

const GARANTIAS = [
  {
    titulo: 'O contato com clientes é sempre seu',
    descricao:
      'Os agentes nunca falam com seus clientes. Eles preparam planos, critérios e roteiros — quem aborda, negocia e fecha é você, em conformidade com a LGPD e o CDC.',
  },
  {
    titulo: 'Somente fontes públicas',
    descricao:
      'Toda pesquisa usa apenas informações públicas disponíveis. Nada de raspagem de dados pessoais nem listas compradas.',
  },
  {
    titulo: 'Transparência no painel',
    descricao:
      'Você acompanha ao vivo o que cada agente está fazendo e aprova cada plano antes de qualquer trabalho começar.',
  },
];

function GarantiaItem({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  const iconRef = useRef<CircleCheckIconHandle>(null);

  return (
    <li
      className="flex items-start gap-3"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <span className="mt-0.5 text-primary">
        <CircleCheckIcon ref={iconRef} size={20} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {titulo}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      </div>
    </li>
  );
}

export function Trust() {
  return (
    <section
      aria-labelledby="confianca-titulo"
      className="border-t border-border/60 py-20 sm:py-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto w-full max-w-6xl px-4 sm:px-6"
      >
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">
              Confiança em primeiro lugar
            </p>
            <h2
              id="confianca-titulo"
              className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            >
              IA que trabalha para você — não no seu lugar
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Esse é o nosso diferencial: os agentes da Trama preparam tudo,
              mas a relação com os seus clientes continua humana e sua.
            </p>
          </div>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GARANTIAS.map((garantia) => (
              <GarantiaItem key={garantia.titulo} {...garantia} />
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
