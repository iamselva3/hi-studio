import type { Env } from './types';
import { HttpError } from './http';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Counts one hit for (bucket, ip) and returns the count inside the current window.
 * The window starts at the first hit and lasts `windowMs`; the upsert is atomic in D1.
 */
export async function hit(env: Env, bucket: string, ip: string, windowMs: number) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, ip, window_start, count) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(bucket, ip) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= ?3 - ?4 THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= ?3 - ?4 THEN ?3 ELSE rate_limits.window_start END
     RETURNING count, window_start`
  )
    .bind(bucket, ip, now, windowMs)
    .first<{ count: number; window_start: number }>();
  if (!row) throw new Error('rate limit upsert returned no row');
  return { count: row.count, retryAfterSeconds: Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000)) };
}

export async function reset(env: Env, bucket: string, ip: string): Promise<void> {
  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ? AND ip = ?').bind(bucket, ip).run();
}

/** Counts a hit and throws 429 once more than `limit` hits happened inside the window. */
export async function enforce(env: Env, bucket: string, ip: string, limit: number, windowMs: number, message: string) {
  const { count, retryAfterSeconds } = await hit(env, bucket, ip, windowMs);
  if (count > limit) throw new HttpError(429, message, {}, { 'Retry-After': String(retryAfterSeconds) });
}

/** Removes rows whose window ended long ago. Run occasionally in the background. */
export async function pruneRateLimits(env: Env): Promise<void> {
  try {
    await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Date.now() - DAY_MS).run();
  } catch (err) {
    console.error('Failed to prune rate_limits', err);
  }
}
