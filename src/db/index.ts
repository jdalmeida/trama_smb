import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';

// Inicialização preguiçosa: nada conecta no carregamento do módulo, então o
// build não quebra sem DATABASE_URL. O pool é criado no primeiro uso e o
// attachDatabasePool() deixa o Vercel Fluid Compute fechar conexões ociosas
// graciosamente antes de suspender a instância.
let _db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não definido. Configure o banco (Neon via Vercel Marketplace).',
    );
  }

  const pool = new Pool({ connectionString });
  attachDatabasePool(pool);

  _db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return _db;
}

export { schema };
