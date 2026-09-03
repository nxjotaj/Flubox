import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  prepare: false,
});
try {
  const [{ total }] =
    await sql`SELECT COUNT(*)::int total FROM drizzle.__drizzle_migrations`;
  if (total > 0) {
    console.log(`Baseline já registrada (${total} migration(s)).`);
    process.exitCode = 0;
  } else {
    const required = [
      'users',
      'organizations',
      'products',
      'orders',
      'ledger_entries',
    ];
    const rows =
      await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(${required})`;
    if (rows.length !== required.length)
      throw new Error(
        'O banco não corresponde ao baseline esperado; nenhuma marcação foi feita.',
      );
    const entries = [
      ['0000_supabase_baseline.sql', 1788272443958],
      ['0001_boolean_columns.sql', 1788272671889],
    ];
    await sql.begin(async (tx) => {
      for (const [file, createdAt] of entries) {
        const content = await readFile(
          new URL(`../drizzle-postgres/${file}`, import.meta.url),
          'utf8',
        );
        const hash = createHash('sha256').update(content).digest('hex');
        await tx`INSERT INTO drizzle.__drizzle_migrations (hash,created_at) VALUES (${hash},${createdAt})`;
      }
    });
    console.log('Baseline existente registrada sem alterar tabelas ou dados.');
  }
} finally {
  await sql.end();
}
