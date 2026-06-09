import Link from 'next/link';

import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#time-de-agentes', label: 'Time de agentes' },
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-md">
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <span aria-hidden="true">🧵</span>
          Trama
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Começar agora</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
