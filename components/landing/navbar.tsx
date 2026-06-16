import Link from 'next/link';

import { SparkleIcon } from '@/components/landing/icons';

const NAV_LINKS = [
  { href: '#como', label: 'Como funciona' },
  { href: '#time', label: 'Time' },
  { href: '#confianca', label: 'Confiança' },
];

export function Navbar() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        background: 'rgba(12,10,18,.55)',
        borderColor: 'rgba(255,255,255,.06)',
      }}
    >
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1180, height: 70, padding: '0 clamp(20px,4vw,32px)' }}
      >
        <Link
          href="/"
          className="flex items-center"
          style={{
            gap: 10,
            fontWeight: 700,
            fontSize: 18,
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
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
              color: '#fff',
            }}
          >
            <SparkleIcon size={17} />
          </span>
          Trama
        </Link>

        <div className="flex items-center" style={{ gap: 'clamp(14px,3vw,28px)' }}>
          <div
            className="hidden items-center sm:flex"
            style={{ gap: 'clamp(14px,3vw,28px)' }}
          >
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="tr-navlink">
                {link.label}
              </a>
            ))}
          </div>
          <Link href="/sign-up" className="tr-btn-pill">
            Começar
          </Link>
        </div>
      </nav>
    </header>
  );
}
