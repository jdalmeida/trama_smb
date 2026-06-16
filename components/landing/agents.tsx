import type { CSSProperties } from 'react';

import {
  ContentIcon,
  SparkleIcon,
  SearchIcon,
  UsersIcon,
} from '@/components/landing/icons';

const PERSONAS = [
  {
    color: '#fbbf77',
    hover: 'rgba(251,191,119,.4)',
    role: 'Atrai clientes',
    name: 'Conteúdo',
    body: 'Plano de conteúdo e canais pensados pro seu público, onde ele já está.',
    delay: '.5s',
    Icon: ContentIcon,
  },
  {
    color: '#7cc4ff',
    hover: 'rgba(124,196,255,.4)',
    role: 'Entende o mercado',
    name: 'Mercado',
    body: 'Pesquisa com fontes públicas: concorrentes, tendências e oportunidades.',
    delay: '1s',
    Icon: SearchIcon,
  },
  {
    color: '#86efac',
    hover: 'rgba(134,239,172,.4)',
    role: 'Prepara a abordagem',
    name: 'Prospecção',
    body: 'Critérios de cliente ideal e roteiros. Quem entra em contato é sempre você.',
    delay: '1.5s',
    Icon: UsersIcon,
  },
];

export function Agents() {
  return (
    <section
      id="time"
      aria-labelledby="time-titulo"
      className="mx-auto"
      style={{
        maxWidth: 1100,
        padding: '0 clamp(20px,4vw,32px) clamp(60px,8vw,90px)',
        scrollMarginTop: 84,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#a78bfa',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            margin: '0 0 12px',
          }}
        >
          O time
        </p>
        <h2
          id="time-titulo"
          style={{
            fontSize: 'clamp(30px,4.5vw,40px)',
            lineHeight: 1.08,
            letterSpacing: '-.03em',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Os fios da sua trama
        </h2>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 480,
            fontSize: 16,
            color: 'rgba(255,255,255,.6)',
          }}
        >
          Personas duráveis e especializadas, coordenadas pelo CEO e
          acompanhadas ao vivo.
        </p>
      </div>

      {/* CEO no topo, centralizado */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            textAlign: 'left',
            gap: 18,
            alignItems: 'flex-start',
            maxWidth: 500,
            background:
              'linear-gradient(135deg,rgba(139,92,246,.2),rgba(139,92,246,.05))',
            border: '1px solid rgba(139,92,246,.45)',
            borderRadius: 18,
            padding: '24px 26px',
            boxShadow: '0 0 70px -22px rgba(139,92,246,.7)',
          }}
        >
          <span
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: '#fff',
              animation: 'tr-float 4s ease-in-out infinite',
            }}
          >
            <SparkleIcon size={26} strokeWidth={1.8} />
          </span>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#c4b5fd',
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                marginBottom: 5,
              }}
            >
              Coordena o time
            </div>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: '0 0 7px',
                letterSpacing: '-.02em',
              }}
            >
              CEO
            </h3>
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,.66)',
                margin: 0,
              }}
            >
              Seu ponto de contato único. Conversa, monta o perfil e{' '}
              <b style={{ color: '#fff', fontWeight: 600 }}>
                delega às personas certas
              </b>
              .
            </p>
          </div>
        </div>
      </div>

      {/* conectores CEO → personas */}
      <div aria-hidden="true" style={{ position: 'relative', height: 46 }}>
        <span style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 24, transform: 'translateX(-1px)', background: 'rgba(139,92,246,.4)' }} />
        <span style={{ position: 'absolute', left: '16.66%', right: '16.66%', top: 23, height: 2, background: 'rgba(139,92,246,.4)' }} />
        <span style={{ position: 'absolute', left: '16.66%', top: 23, width: 2, height: 23, transform: 'translateX(-1px)', background: 'rgba(139,92,246,.4)' }} />
        <span style={{ position: 'absolute', left: '50%', top: 23, width: 2, height: 23, transform: 'translateX(-1px)', background: 'rgba(139,92,246,.4)' }} />
        <span style={{ position: 'absolute', left: '83.33%', top: 23, width: 2, height: 23, transform: 'translateX(-1px)', background: 'rgba(139,92,246,.4)' }} />
        <span style={{ position: 'absolute', left: '50%', top: 18, width: 9, height: 9, borderRadius: 99, transform: 'translate(-50%,0)', background: '#a78bfa', boxShadow: '0 0 12px 2px rgba(167,139,250,.6)' }} />
      </div>

      {/* personas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 18,
        }}
      >
        {PERSONAS.map(({ Icon, ...p }) => (
          <div
            key={p.name}
            className="tr-persona"
            style={{ '--tr-hover': p.hover } as CSSProperties}
          >
            <span
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 13,
                background: 'rgba(255,255,255,.07)',
                color: p.color,
                animation: `tr-float 4s ease-in-out ${p.delay} infinite`,
              }}
            >
              <Icon size={24} strokeWidth={1.8} />
            </span>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: p.color,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                {p.role}
              </div>
              <h3
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  margin: '0 0 7px',
                  letterSpacing: '-.02em',
                }}
              >
                {p.name}
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,.6)',
                  margin: 0,
                }}
              >
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
