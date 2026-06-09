'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { RocketIcon, type RocketIconHandle } from '@/components/ui/rocket';

export function FinalCta() {
  const rocketRef = useRef<RocketIconHandle>(null);

  return (
    <section
      aria-labelledby="cta-final-titulo"
      className="relative overflow-hidden py-20 sm:py-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[-14rem] left-1/2 h-[24rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6"
      >
        <h2
          id="cta-final-titulo"
          className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Pronto para montar o seu time?
        </h2>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Crie sua conta, converse com o CEO da Trama e receba os primeiros
          planos para o seu negócio.
        </p>
        <Button size="lg" className="mt-8 h-11 px-6 text-base" asChild>
          <Link
            href="/sign-up"
            onMouseEnter={() => rocketRef.current?.startAnimation()}
            onMouseLeave={() => rocketRef.current?.stopAnimation()}
          >
            Começar agora
            <RocketIcon ref={rocketRef} size={18} aria-hidden="true" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
