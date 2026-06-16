import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: 'Trama — seu time de agentes para crescer',
  description:
    'Encontre clientes e entenda seu mercado com um time de agentes de IA que trabalham para o seu negócio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={cn("font-sans", geist.variable, geistMono.variable)}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
