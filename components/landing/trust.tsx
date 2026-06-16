import { CheckIcon, ShieldCheckIcon } from '@/components/landing/icons';

const GARANTIAS = [
  {
    titulo: 'O contato com clientes é sempre seu',
    descricao:
      'Os agentes nunca falam com seus clientes. Quem aborda e fecha é você, conforme LGPD e CDC.',
  },
  {
    titulo: 'Somente fontes públicas',
    descricao:
      'Nada de raspagem de dados pessoais nem listas compradas.',
  },
  {
    titulo: 'Transparência no painel',
    descricao:
      'Acompanhe ao vivo o que cada agente faz e aprove cada plano antes de começar.',
  },
];

export function Trust() {
  return (
    <section
      id="confianca"
      aria-labelledby="confianca-titulo"
      className="mx-auto"
      style={{
        maxWidth: 1100,
        padding: '0 clamp(20px,4vw,32px) clamp(60px,8vw,90px)',
        scrollMarginTop: 84,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 'clamp(28px,4vw,48px)',
          alignItems: 'center',
          background:
            'linear-gradient(135deg,rgba(139,92,246,.1),rgba(192,38,211,.05))',
          border: '1px solid rgba(139,92,246,.24)',
          borderRadius: 24,
          padding: 'clamp(30px,4vw,48px)',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              borderRadius: 13,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: '#fff',
              marginBottom: 18,
            }}
          >
            <ShieldCheckIcon size={23} strokeWidth={1.9} />
          </span>
          <h2
            id="confianca-titulo"
            style={{
              fontSize: 'clamp(26px,3.6vw,32px)',
              lineHeight: 1.12,
              letterSpacing: '-.03em',
              fontWeight: 700,
              margin: 0,
            }}
          >
            IA que trabalha pra você — não no seu lugar
          </h2>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 15.5,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,.62)',
            }}
          >
            Os agentes preparam tudo, mas a relação com seus clientes continua
            humana e sua. Esse é o nosso compromisso.
          </p>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {GARANTIAS.map((g) => (
            <li
              key={g.titulo}
              style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}
            >
              <span style={{ flex: 'none', marginTop: 1, color: '#86efac' }}>
                <CheckIcon size={20} strokeWidth={2.2} />
              </span>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 3 }}>
                  {g.titulo}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'rgba(255,255,255,.58)',
                  }}
                >
                  {g.descricao}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
