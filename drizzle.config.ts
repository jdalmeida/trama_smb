import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit não carrega .env.local sozinho (só o Next faz isso); o arquivo
// vem de `vercel env pull` e é onde moram as credenciais reais do Neon.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

// Migrações usam a conexão DIRETA (unpooled). O pooler (PgBouncer) em modo
// transação quebra recursos de sessão que as ferramentas de migração usam.
const url =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url },
});
