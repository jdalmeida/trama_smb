'use client';

import { useRef, type ComponentType, type RefObject } from 'react';
import { motion, type Variants } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BotIcon } from '@/components/ui/bot';
import { ZapIcon } from '@/components/ui/zap';
import { SearchIcon } from '@/components/ui/search';
import { UsersIcon } from '@/components/ui/users';

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

type Agent = {
  emoji: string;
  nome: string;
  papel: string;
  descricao: string;
  Icone: AnimatedIcon;
  destaque?: boolean;
};

const AGENTS: Agent[] = [
  {
    emoji: '🧠',
    nome: 'CEO',
    papel: 'Coordena o time',
    descricao:
      'Conversa com você, monta o Perfil do Negócio, propõe planos de trabalho e delega tarefas às personas certas. É o seu ponto de contato único.',
    Icone: BotIcon as AnimatedIcon,
    destaque: true,
  },
  {
    emoji: '📣',
    nome: 'Conteúdo / Aquisição',
    papel: 'Atrai clientes',
    descricao:
      'Entrega um plano de conteúdo e canais: temas, formatos e calendário pensados para o seu público, para atrair clientes onde eles já estão.',
    Icone: ZapIcon as AnimatedIcon,
  },
  {
    emoji: '🔎',
    nome: 'Pesquisa de Mercado',
    papel: 'Entende o mercado',
    descricao:
      'Faz pesquisa de mercado com fontes públicas: concorrentes, tendências e oportunidades no seu segmento, organizadas em um relatório claro.',
    Icone: SearchIcon as AnimatedIcon,
  },
  {
    emoji: '🤝',
    nome: 'Vendas / Prospecção',
    papel: 'Prepara a abordagem',
    descricao:
      'Monta um plano de prospecção com critérios de cliente ideal e roteiros de abordagem. Quem entra em contato é sempre você.',
    Icone: UsersIcon as AnimatedIcon,
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.1 },
  }),
};

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const { Icone } = agent;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      <Card
        className={`h-full transition-all duration-300 hover:-translate-y-1 ${
          agent.destaque
            ? 'ring-primary/40 hover:ring-primary/60'
            : 'hover:ring-primary/30'
        }`}
        onMouseEnter={() => iconRef.current?.startAnimation()}
        onMouseLeave={() => iconRef.current?.stopAnimation()}
      >
        <CardHeader>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icone ref={iconRef} size={22} aria-hidden="true" />
            </span>
            <Badge variant="secondary" className="text-xs">
              {agent.papel}
            </Badge>
          </div>
          <CardTitle className="text-lg tracking-tight">
            <span aria-hidden="true" className="mr-1.5">
              {agent.emoji}
            </span>
            {agent.nome}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm leading-relaxed">
            {agent.descricao}
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function Agents() {
  return (
    <section
      id="time-de-agentes"
      aria-labelledby="time-de-agentes-titulo"
      className="scroll-mt-20 border-t border-border/60 bg-secondary/30 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium text-primary">Time de agentes</p>
          <h2
            id="time-de-agentes-titulo"
            className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Conheça quem trabalha pelo seu negócio
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Personas duráveis e especializadas, coordenadas pelo CEO e
            acompanhadas ao vivo no painel Time.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent, index) => (
            <AgentCard key={agent.nome} agent={agent} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
