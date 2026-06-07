import { defineConfig } from 'drizzle-kit';

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
