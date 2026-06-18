import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Console } from '@/components/console';

export const dynamic = 'force-dynamic';

export default async function ConsolePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // O guard de auth fica no server; o console (client) renderiza o próprio
  // header (branding + Perfil do negócio + UserButton) e o corpo.
  return <Console />;
}
