import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rotas públicas: auth e os endpoints internos do Workflow DevKit
// (/.well-known/workflow/* são chamados pela infra, sem sessão de usuário).
const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/.well-known/workflow(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
