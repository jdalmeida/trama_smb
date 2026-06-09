import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Agents } from '@/components/landing/agents';
import { Trust } from '@/components/landing/trust';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/console');

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Agents />
        <Trust />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
