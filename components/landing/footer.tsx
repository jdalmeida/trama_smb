import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>
          <span aria-hidden="true">🧵</span> © 2026 Trama
        </p>
        <nav aria-label="Rodapé" className="flex items-center gap-6">
          <Link href="/sign-in" className="transition-colors hover:text-foreground">
            Entrar
          </Link>
          <Link href="/sign-up" className="transition-colors hover:text-foreground">
            Criar conta
          </Link>
        </nav>
      </div>
    </footer>
  );
}
