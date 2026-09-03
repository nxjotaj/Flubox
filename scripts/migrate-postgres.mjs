import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
const client = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  prepare: false,
});
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle-postgres' });
  console.log('Migrations PostgreSQL aplicadas e registradas.');
} finally {
  await client.end();
}
