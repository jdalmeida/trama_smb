import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { Console } from '@/components/console';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <main className="mx-auto flex h-screen max-w-6xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            🧵
          </span>
          <span className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            Trama
          </span>
        </div>
        <UserButton />
      </header>

      <Console />
    </main>
  );
}
