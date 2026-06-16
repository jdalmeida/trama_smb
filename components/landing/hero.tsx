import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

import {
  ArrowRightIcon,
  ContentIcon,
  SparkleIcon,
  SearchIcon,
  UsersIcon,
} from '@/components/landing/icons';
import { CTA_LABEL } from '@/components/landing/constants';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-titulo"
      className="relative mx-auto grid items-center overflow-hidden"
      style={{
        maxWidth: 1180,
        gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))',
        gap: 'clamp(28px,5vw,56px)',
        padding:
          'clamp(40px,7vw,80px) clamp(20px,4vw,32px) clamp(40px,6vw,64px)',
      }}
    >
      {/* coluna texto */}
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            fontSize: 13,
            fontWeight: 500,
            color: '#d6c9ff',
            background: 'rgba(139,92,246,.12)',
            border: '1px solid rgba(139,92,246,.32)',
            padding: '7px 15px',
            borderRadius: 99,
            animation: 'tr-up .6s ease both',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: '#a78bfa',
              animation: 'tr-glow 1.8s infinite',
            }}
          />
          Inteligência que se entrelaça
        </span>

        <h1
          id="hero-titulo"
          style={
            {
              margin: '24px 0 0',
              fontSize: 'clamp(42px,5.6vw,68px)',
              lineHeight: 1,
              letterSpacing: '-.045em',
              fontWeight: 800,
              textWrap: 'balance',
              animation: 'tr-up .6s ease .08s both',
            } as CSSProperties
          }
        >
          A trama que faz
          <br />
          seu negócio
          <br />
          <span
            style={{
              background: 'linear-gradient(120deg,#c4b5fd,#8b5cf6 45%,#e879f9)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            crescer
          </span>
        </h1>

        <p
          style={
            {
              margin: '26px 0 0',
              maxWidth: 480,
              fontSize: 'clamp(16px,1.6vw,18px)',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,.66)',
              textWrap: 'pretty',
              animation: 'tr-up .6s ease .16s both',
            } as CSSProperties
          }
        >
          Vários agentes de IA, um só propósito. Eles se coordenam como fios de
          um mesmo tecido — cada um cuida de uma parte, todos puxam o seu
          negócio pra frente.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 32,
            animation: 'tr-up .6s ease .24s both',
          }}
        >
          <Link
            href="/sign-up"
            className="tr-btn-white"
            style={{ fontSize: 15.5, padding: '14px 24px' }}
          >
            {CTA_LABEL}
            <ArrowRightIcon size={17} />
          </Link>
          <a
            href="#como"
            className="tr-btn-ghost"
            style={{ fontSize: 15.5, padding: '14px 24px' }}
          >
            Ver como funciona
          </a>
        </div>

        <p
          style={{
            marginTop: 18,
            fontSize: 13,
            color: 'rgba(255,255,255,.4)',
            animation: 'tr-up .6s ease .3s both',
          }}
        >
          Sem cartão · Em português · Você sempre no controle
        </p>
      </div>

      {/* coluna constelação dos agentes */}
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          justifySelf: 'center',
          aspectRatio: '1',
          animation: 'tr-up .7s ease .2s both',
        }}
      >
        {/* glow de fundo */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '74%',
            height: '74%',
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background:
              'radial-gradient(circle,rgba(139,92,246,.3),transparent 68%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />

        <svg
          viewBox="0 0 480 480"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          {/* anéis girando + pontos em órbita */}
          <g
            style={{
              transformBox: 'view-box',
              transformOrigin: '240px 240px',
              animation: 'tr-spin 80s linear infinite',
            }}
          >
            <circle cx="240" cy="240" r="108" fill="none" stroke="rgba(167,139,250,.16)" strokeWidth="1" />
            <circle cx="240" cy="240" r="168" fill="none" stroke="rgba(167,139,250,.13)" strokeWidth="1" />
            <circle cx="240" cy="240" r="228" fill="none" stroke="rgba(167,139,250,.1)" strokeWidth="1" strokeDasharray="2 8" />
            <circle cx="240" cy="132" r="3" fill="#c4b5fd" opacity=".8" />
            <circle cx="408" cy="240" r="2.6" fill="#a78bfa" opacity=".6" />
            <circle cx="240" cy="468" r="2.4" fill="#e879f9" opacity=".55" />
            <circle cx="72" cy="240" r="2.4" fill="#7cc4ff" opacity=".5" />
          </g>
          {/* fios CEO → personas */}
          <g style={{ animation: 'tr-dash 3s linear infinite' }}>
            <line x1="240" y1="240" x2="95" y2="150" stroke="rgba(167,139,250,.34)" strokeWidth="1.3" strokeDasharray="3 7" />
            <line x1="240" y1="240" x2="385" y2="170" stroke="rgba(167,139,250,.34)" strokeWidth="1.3" strokeDasharray="3 7" />
            <line x1="240" y1="240" x2="240" y2="400" stroke="rgba(167,139,250,.34)" strokeWidth="1.3" strokeDasharray="3 7" />
          </g>
        </svg>

        {/* pulsos no centro */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 150,
            height: 150,
            borderRadius: '50%',
            border: '1px solid rgba(167,139,250,.5)',
            animation: 'tr-pulse 3.4s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 150,
            height: 150,
            borderRadius: '50%',
            border: '1px solid rgba(167,139,250,.5)',
            animation: 'tr-pulse 3.4s ease-out 1.7s infinite',
            pointerEvents: 'none',
          }}
        />

        {/* núcleo: CEO */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 138,
            height: 138,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background:
              'radial-gradient(circle at 50% 36%,rgba(139,92,246,.5),rgba(124,58,237,.14))',
            border: '1px solid rgba(167,139,250,.55)',
            boxShadow:
              '0 0 64px -10px rgba(139,92,246,.75),inset 0 0 34px rgba(139,92,246,.28)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: '#fff',
              boxShadow: '0 6px 18px -6px rgba(124,58,237,.9)',
            }}
          >
            <SparkleIcon size={22} strokeWidth={1.8} />
          </span>
          <span style={{ marginTop: 4, fontSize: 15, fontWeight: 700, letterSpacing: '-.02em' }}>
            CEO
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono), monospace',
              color: '#c4b5fd',
              letterSpacing: '.04em',
            }}
          >
            coordena
          </span>
        </div>

        {/* persona: Conteúdo */}
        <OrbitNode left="19.8%" top="31.25%" delay="0s">
          <PersonaBadge color="#fbbf77" bg="rgba(251,191,119,.15)" border="rgba(251,191,119,.4)" label="Conteúdo">
            <ContentIcon size={25} strokeWidth={1.9} />
          </PersonaBadge>
        </OrbitNode>

        {/* persona: Mercado */}
        <OrbitNode left="80.2%" top="35.4%" delay="1s">
          <PersonaBadge color="#7cc4ff" bg="rgba(124,196,255,.15)" border="rgba(124,196,255,.4)" label="Mercado">
            <SearchIcon size={24} strokeWidth={1.9} />
          </PersonaBadge>
        </OrbitNode>

        {/* persona: Prospecção */}
        <OrbitNode left="50%" top="83.3%" delay="2s">
          <PersonaBadge color="#86efac" bg="rgba(134,239,172,.15)" border="rgba(134,239,172,.4)" label="Prospecção">
            <UsersIcon size={24} strokeWidth={1.9} />
          </PersonaBadge>
        </OrbitNode>

        {/* pontos de sinal */}
        <span
          style={{
            position: 'absolute',
            left: '31%',
            top: '74%',
            transform: 'translate(-50%,-50%)',
            width: 9,
            height: 9,
            borderRadius: 99,
            background: '#c4b5fd',
            boxShadow: '0 0 14px 2px rgba(167,139,250,.6)',
            animation: 'tr-glow 2.4s infinite',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '75%',
            top: '68%',
            transform: 'translate(-50%,-50%)',
            width: 7,
            height: 7,
            borderRadius: 99,
            background: '#e879f9',
            boxShadow: '0 0 12px 2px rgba(232,121,249,.55)',
            animation: 'tr-glow 2.8s .4s infinite',
          }}
        />
      </div>
    </section>
  );
}

function OrbitNode({
  left,
  top,
  delay,
  children,
}: {
  left: string;
  top: string;
  delay: string;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'absolute', left, top, transform: 'translate(-50%,-50%)' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          animation: `tr-float 5s ease-in-out ${delay} infinite`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PersonaBadge({
  color,
  bg,
  border,
  label,
  children,
}: {
  color: string;
  bg: string;
  border: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 54,
          height: 54,
          borderRadius: 15,
          background: bg,
          border: `1px solid ${border}`,
          color,
          boxShadow: `0 0 32px -6px ${border}`,
        }}
      >
        {children}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>
        {label}
      </span>
    </>
  );
}
