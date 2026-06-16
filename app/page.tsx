import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { ProductPeek } from '@/components/landing/product-peek';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Agents } from '@/components/landing/agents';
import { Trust } from '@/components/landing/trust';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { WeaveBackground } from '@/components/landing/weave-background';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/console');

  return (
    <div
      className="trama-landing relative min-h-dvh text-white"
      style={{ background: '#0c0a12', fontFamily: 'var(--font-sans), sans-serif' }}
    >
      {/* fios de IA se entrelaçando — cobre a página inteira */}
      <WeaveBackground />
      {/* glow superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1000px 540px at 50% -6%, hsla(285,75%,62%,0.22), transparent 70%)',
        }}
      />

      <div className="relative" style={{ zIndex: 2 }}>
        <Navbar />
        <main>
          <Hero />
          <ProductPeek />
          <HowItWorks />
          <Agents />
          <Trust />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
