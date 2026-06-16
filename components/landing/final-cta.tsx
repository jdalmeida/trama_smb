import Link from 'next/link';

import { ArrowRightIcon } from '@/components/landing/icons';
import { CTA_LABEL } from '@/components/landing/constants';

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-final-titulo"
      className="mx-auto"
      style={{
        maxWidth: 780,
        textAlign: 'center',
        padding:
          'clamp(20px,3vw,40px) clamp(20px,4vw,32px) clamp(70px,9vw,110px)',
      }}
    >
      <div
        style={{
          background:
            'linear-gradient(135deg,rgba(139,92,246,.18),rgba(192,38,211,.1))',
          border: '1px solid rgba(139,92,246,.3)',
          borderRadius: 28,
          padding: 'clamp(40px,6vw,60px) clamp(28px,4vw,44px)',
        }}
      >
        <h2
          id="cta-final-titulo"
          style={{
            fontSize: 'clamp(34px,5.2vw,46px)',
            lineHeight: 1.04,
            letterSpacing: '-.035em',
            fontWeight: 800,
            margin: 0,
          }}
        >
          Comece a tecer hoje
        </h2>
        <p
          style={{
            margin: '16px auto 0',
            maxWidth: 440,
            fontSize: 16.5,
            color: 'rgba(255,255,255,.66)',
          }}
        >
          Converse com o CEO da Trama e veja o seu time ganhar forma em minutos.
        </p>
        <Link
          href="/sign-up"
          className="tr-btn-white"
          style={{ marginTop: 28, fontSize: 16, padding: '14px 28px' }}
        >
          {CTA_LABEL}
          <ArrowRightIcon size={18} />
        </Link>
        <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
          Sem cartão de crédito
        </p>
      </div>
    </section>
  );
}
