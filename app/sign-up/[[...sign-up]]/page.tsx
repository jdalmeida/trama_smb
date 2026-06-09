'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background"
      />

      <div className="relative flex flex-col items-center gap-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🧵
          </span>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            Trama
          </span>
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">
          Crie sua conta e monte seu time de agentes.
        </p>
      </div>

      <div className="relative rounded-2xl border border-border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
        <SignUp />
      </div>
    </main>
  );
}
