'use client';

import { useRef, type ComponentType, type RefObject } from 'react';
import { motion, type Variants } from 'motion/react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MessageCircleMoreIcon } from '@/components/ui/message-circle-more';
import { WorkflowIcon } from '@/components/ui/workflow';
import { FileTextIcon } from '@/components/ui/file-text';

type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIcon = ComponentType<{
  ref?: RefObject<AnimatedIconHandle | null>;
  size?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

type Step = {
  numero: string;
  titulo: string;
  descricao: string;
  Icone: AnimatedIcon;
};

const STEPS: Step[] = [
  {
    numero: '1',
    titulo: 'Conte sobre o seu negócio',
    descricao:
      'Converse com o CEO da Trama como conversaria com um sócio: o que você vende, para quem e onde. Ele monta o Perfil do Negócio com você.',
    Icone: MessageCircleMoreIcon as AnimatedIcon,
  },
  {
    numero: '2',
    titulo: 'Aprove o plano proposto',
    descricao:
      'O CEO propõe um plano de trabalho claro e delega tarefas às personas certas do time. Nada acontece sem a sua aprovação.',
    Icone: WorkflowIcon as AnimatedIcon,
  },
  {
    numero: '3',
    titulo: 'Acompanhe e receba os planos',
    descricao:
      'Veja o time trabalhando ao vivo no painel e receba planos acionáveis: conteúdo, pesquisa de mercado e prospecção prontos para você executar.',
    Icone: FileTextIcon as AnimatedIcon,
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.12 },
  }),
};

function StepCard({ step, index }: { step: Step; index: number }) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const { Icone } = step;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      <Card
        className="h-full transition-all duration-300 hover:-translate-y-1 hover:ring-primary/30"
        onMouseEnter={() => iconRef.current?.startAnimation()}
        onMouseLeave={() => iconRef.current?.stopAnimation()}
      >
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icone ref={iconRef} size={20} aria-hidden="true" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Passo {step.numero}
            </span>
          </div>
          <CardTitle className="text-lg tracking-tight">
            {step.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm leading-relaxed">
            {step.descricao}
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium text-primary">Como funciona</p>
          <h2
            id="como-funciona-titulo"
            className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Do primeiro papo ao plano pronto, em três passos
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Sem formulários intermináveis: você conversa, aprova e acompanha.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <StepCard key={step.numero} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
