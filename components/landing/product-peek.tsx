import type { CSSProperties, ReactNode } from 'react';

import {
  ContentIcon,
  SparkleIcon,
  SearchIcon,
  UsersIcon,
} from '@/components/landing/icons';

// "Peek" do produto: mockup do console no tema escuro (chat do CEO + painel Time).
export function ProductPeek() {
  return (
    <section
      aria-label="Prévia do produto"
      className="mx-auto"
      style={{
        maxWidth: 1000,
        padding: '0 clamp(20px,4vw,32px) clamp(60px,8vw,100px)',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,.045)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 22,
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
          boxShadow: '0 40px 90px -40px rgba(0,0,0,.8)',
        }}
      >
        {/* barra de janela */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <Dot />
          <Dot />
          <Dot />
          <span
            style={{
              marginLeft: 8,
              fontSize: 12,
              color: 'rgba(255,255,255,.4)',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            trama.app/console
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          }}
        >
          {/* chat */}
          <div
            style={{
              padding: 20,
              borderRight: '1px solid rgba(255,255,255,.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 13,
              minHeight: 300,
            }}
          >
            <AgentBubble>
              Entendi! Você tem uma{' '}
              <b style={{ color: '#fff' }}>marcenaria sob medida</b> em Curitiba.
              Posso montar um plano pra atrair mais clientes?
            </AgentBubble>
            <UserBubble>Pode sim, manda ver</UserBubble>
            <AgentBubble>
              Perfeito. Deleguei pro time — acompanhe ao lado. 🧵
            </AgentBubble>
          </div>

          {/* time */}
          <div style={{ padding: 18, background: 'rgba(255,255,255,.025)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.5)',
                }}
              >
                Time
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: '#86efac',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: '#86efac',
                    animation: 'tr-glow 1.6s infinite',
                  }}
                />
                2 ativos
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <TeamRow
                color="#fbbf77"
                bg="rgba(251,191,119,.16)"
                label="Conteúdo"
                status="trabalhando"
                progress={68}
                delay="0s"
              >
                <ContentIcon size={14} />
              </TeamRow>
              <TeamRow
                color="#7cc4ff"
                bg="rgba(124,196,255,.16)"
                label="Mercado"
                status="trabalhando"
                progress={41}
                delay=".2s"
              >
                <SearchIcon size={14} />
              </TeamRow>
              <TeamRow
                color="#86efac"
                bg="rgba(134,239,172,.16)"
                label="Prospecção"
                status="na fila"
              >
                <UsersIcon size={14} />
              </TeamRow>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return (
    <span
      style={{
        width: 11,
        height: 11,
        borderRadius: 99,
        background: 'rgba(255,255,255,.18)',
      }}
    />
  );
}

function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'rgba(139,92,246,.22)',
          color: '#c4b5fd',
        }}
      >
        <SparkleIcon size={15} />
      </span>
      <div
        style={{
          background: 'rgba(255,255,255,.07)',
          borderRadius: '4px 14px 14px 14px',
          padding: '11px 14px',
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,.88)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        flexDirection: 'row-reverse',
      }}
    >
      <span
        style={{
          flex: 'none',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: '#fff',
          color: '#0c0a12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        VC
      </span>
      <div
        style={{
          background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
          color: '#fff',
          borderRadius: '14px 4px 14px 14px',
          padding: '11px 14px',
          fontSize: 13.5,
          lineHeight: 1.5,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TeamRow({
  color,
  bg,
  label,
  status,
  progress,
  delay,
  children,
}: {
  color: string;
  bg: string;
  label: string;
  status: string;
  progress?: number;
  delay?: string;
  children: ReactNode;
}) {
  const idle = progress === undefined;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 12,
        padding: '11px 12px',
        opacity: idle ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: bg,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10.5,
            fontWeight: 600,
            color: idle ? 'rgba(255,255,255,.5)' : color,
            background: idle ? 'rgba(255,255,255,.07)' : `${bg}`,
            padding: '2px 8px',
            borderRadius: 99,
          }}
        >
          {status}
        </span>
      </div>
      {!idle && (
        <div
          style={{
            marginTop: 9,
            height: 5,
            borderRadius: 99,
            background: 'rgba(255,255,255,.08)',
            overflow: 'hidden',
          }}
        >
          <span
            style={
              {
                display: 'block',
                height: '100%',
                background: color,
                '--w': `${progress}%`,
                width: `${progress}%`,
                animation: `tr-bar 2.4s ease ${delay ?? '0s'} both`,
              } as CSSProperties
            }
          />
        </div>
      )}
    </div>
  );
}
