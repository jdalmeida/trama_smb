import type { CSSProperties } from 'react';

const STEPS = [
  {
    n: '01',
    color: '#7c3aed',
    hover: 'rgba(139,92,246,.4)',
    title: 'Você conversa',
    body: 'Conte sobre o negócio pro CEO da Trama como conversaria com um sócio. Ele entende o contexto e monta o Perfil do Negócio com você.',
  },
  {
    n: '02',
    color: '#9333ea',
    hover: 'rgba(147,51,234,.4)',
    title: 'Os fios se cruzam',
    body: 'Aprovado o plano, o CEO delega às personas. Cada agente puxa o seu fio, coordenados em tempo real. Nada anda sem o seu ok.',
  },
  {
    n: '03',
    color: '#c026d3',
    hover: 'rgba(192,38,211,.4)',
    title: 'Vira tecido',
    body: 'Você recebe planos acionáveis — conteúdo, mercado e prospecção — costurados num só lugar, prontos pra executar.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="como"
      aria-labelledby="como-titulo"
      className="mx-auto"
      style={{
        maxWidth: 1100,
        padding:
          'clamp(20px,3vw,40px) clamp(20px,4vw,32px) clamp(60px,8vw,90px)',
        scrollMarginTop: 84,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 50 }}>
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
          Como funciona
        </p>
        <h2
          id="como-titulo"
          style={{
            fontSize: 'clamp(30px,4.5vw,40px)',
            lineHeight: 1.08,
            letterSpacing: '-.03em',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Três fios, um tecido
        </h2>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 480,
            fontSize: 16,
            color: 'rgba(255,255,255,.6)',
          }}
        >
          Do primeiro papo ao plano pronto. Você conversa, aprova e acompanha.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 20,
        }}
      >
        {STEPS.map((step) => (
          <div
            key={step.n}
            className="tr-step"
            style={{ '--tr-hover': step.hover } as CSSProperties}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 32,
                fontWeight: 500,
                color: step.color,
                marginBottom: 18,
              }}
            >
              {step.n}
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-.02em',
                margin: '0 0 8px',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,.6)',
                margin: 0,
              }}
            >
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
