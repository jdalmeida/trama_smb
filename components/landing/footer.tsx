import Link from 'next/link';

import { SparkleIcon } from '@/components/landing/icons';

const FOOTER_LINKS = [
  { href: '#como', label: 'Como funciona' },
  { href: '#time', label: 'Time' },
  { href: '#confianca', label: 'Confiança' },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,.08)',
        padding: '36px clamp(20px,4vw,32px)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 1180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          className="flex items-center"
          style={{
            gap: 10,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-.02em',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: '#fff',
            }}
          >
            <SparkleIcon size={14} />
          </span>
          Trama
        </Link>

        <nav
          aria-label="Rodapé"
          style={{ display: 'flex', gap: 22, fontSize: 13.5 }}
        >
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="tr-footlink">
              {link.label}
            </a>
          ))}
        </nav>

        <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)' }}>
          © 2026 Trama · Feito no Brasil · Apenas fontes públicas, conforme LGPD
        </span>
      </div>
    </footer>
  );
}
