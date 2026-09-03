import { getD1 } from '@/db';
export async function GET() {
  const started = Date.now();
  try {
    await getD1().prepare('SELECT 1 ok').first();
    return Response.json(
      {
        status: 'ok',
        database: 'ok',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json(
      {
        status: 'degraded',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
