'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, type Variants } from 'motion/react';

import { Button } from '@/components/ui/button';
import {
  ArrowRightIcon,
  type ArrowRightIconHandle,
} from '@/components/ui/arrow-right';

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut' },
  },
};

export function Hero() {
  const arrowRef = useRef<ArrowRightIconHandle>(null);

  return (
    <section
      aria-labelledby="hero-titulo"
      className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28"
    >
      {/* Glow violeta sutil sobre o fundo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-12rem] left-1/2 h-[26rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-[6rem] left-[12%] h-[14rem] w-[18rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-primary/5 to-transparent" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6"
      >
        <motion.p
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-foreground sm:text-sm"
        >
          <span aria-hidden="true">🧵</span>
          Time de agentes de IA para PMEs brasileiras
        </motion.p>

        <motion.h1
          id="hero-titulo"
          variants={item}
          className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl"
        >
          Um time de agentes de IA para o seu negócio crescer
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-2xl text-base text-balance text-muted-foreground sm:text-lg"
        >
          Converse com o CEO da Trama sobre o seu negócio, aprove o plano e
          acompanhe agentes especializados trabalhando para encontrar
          oportunidades de clientes e entender o seu mercado — em português,
          com fontes públicas e você sempre no controle.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button size="lg" className="h-11 px-6 text-base" asChild>
            <Link
              href="/sign-up"
              onMouseEnter={() => arrowRef.current?.startAnimation()}
              onMouseLeave={() => arrowRef.current?.stopAnimation()}
            >
              Começar agora
              <ArrowRightIcon ref={arrowRef} size={18} aria-hidden="true" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-6 text-base"
            asChild
          >
            <a href="#como-funciona">Ver como funciona</a>
          </Button>
        </motion.div>

        <motion.p variants={item} className="mt-6 text-xs text-muted-foreground">
          O contato com seus clientes é sempre seu — os agentes preparam, você
          decide.
        </motion.p>
      </motion.div>
    </section>
  );
}
