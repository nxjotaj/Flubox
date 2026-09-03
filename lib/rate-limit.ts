import { getD1 } from '@/db';
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Date.now(),
    windowStart = new Date(
      Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000,
    ).toISOString();
  await getD1()
    .prepare(
      `INSERT INTO rate_limit_buckets (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key,window_start) DO UPDATE SET count=rate_limit_buckets.count+1`,
    )
    .bind(key, windowStart)
    .run();
  const row = await getD1()
    .prepare(
      `SELECT count FROM rate_limit_buckets WHERE key=? AND window_start=?`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return {
    allowed: (row?.count ?? 1) <= limit,
    remaining: Math.max(0, limit - (row?.count ?? 1)),
  };
}
