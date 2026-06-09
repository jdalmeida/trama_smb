import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { Console } from '@/components/console';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

export default async function ConsolePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex h-6 items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                🧵
              </span>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Trama
              </span>
            </div>
            <Separator orientation="vertical" />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Seu time de agentes
            </span>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-4 py-4">
        <Console />
      </div>
    </main>
  );
}
