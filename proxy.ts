import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rotas públicas: auth, os endpoints internos do Workflow DevKit
// (/.well-known/workflow/* são chamados pela infra, sem sessão de usuário) e o
// webhook da Meta (a Meta entrega eventos sem sessão; o negócio é resolvido
// pelo id externo da conta dentro do handler).
const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/.well-known/workflow(.*)',
  '/api/channels/webhook(.*)',
  '/api/channels/evolution/webhook(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
