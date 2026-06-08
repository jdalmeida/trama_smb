'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🧵
        </span>
        <span className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
          Trama
        </span>
      </div>
      <SignIn />
    </main>
  );
}
