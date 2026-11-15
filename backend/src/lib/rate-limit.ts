import { env } from './env';

/**
 * Fixed-window limiter: in-process on one node, shared through Redis once the app runs
 * on more than one instance.
 *
 * `RATE_LIMIT_REDIS_URL` is the HTTP endpoint of a Redis gateway (Upstash, Redis Cloud
 * "HTTP interface"), counted through a small EVAL script so the counter and its expiry
 * land in one atomic round trip. Without it the buckets below are per-process, which is
 * correct for a single server and only approximate behind a load balancer.
 *
 * A Redis failure falls back to the in-process buckets rather than rejecting sign-ins:
 * the limiter protects the SMS bill, not the database, so an outage should cost accuracy
 * and not availability.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type LimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** INCR, then (re-)arm the window whenever the key has no TTL — heals a crashed write. */
const WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return { count, redis.call('TTL', KEYS[1]) }
`;

const REDIS_KEY_PREFIX = 'bemz:rl:';
const REDIS_TIMEOUT_MS = 1_500;
/** After a failed call, stop reaching out for this long so one outage does not slow every request. */
const REDIS_COOLDOWN_MS = 30_000;

let redisUnavailableUntil = 0;

function consumeLocal(key: string, limit: number, windowSeconds: number): LimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

function redisEndpoint(): { url: string; headers: Record<string, string> } | null {
  const { RATE_LIMIT_REDIS_URL, RATE_LIMIT_REDIS_TOKEN } = env();
  if (!RATE_LIMIT_REDIS_URL) return null;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (RATE_LIMIT_REDIS_TOKEN) headers.authorization = `Bearer ${RATE_LIMIT_REDIS_TOKEN}`;
  return { url: `${RATE_LIMIT_REDIS_URL.replace(/\/+$/, '')}/pipeline`, headers };
}

/** `/pipeline` wraps each command result in an array; a plain command response is already unwrapped. */
function unwrap(result: unknown): unknown[] {
  const first = Array.isArray(result) && Array.isArray(result[0]) && result.length === 1 ? result[0] : result;
  return Array.isArray(first) ? first : [];
}

async function consumeRedis(
  endpoint: { url: string; headers: Record<string, string> },
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<LimitResult> {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: endpoint.headers,
    body: JSON.stringify([['EVAL', WINDOW_SCRIPT, '1', `${REDIS_KEY_PREFIX}${key}`, limit, windowSeconds]]),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Redis responded ${response.status}`);

  const [count, ttl] = unwrap(await response.json());
  const used = Number(count);
  if (!Number.isFinite(used)) throw new Error('Redis returned no counter');

  const remainingTtl = Math.max(1, Number(ttl) > 0 ? Number(ttl) : windowSeconds);
  return {
    allowed: used <= limit,
    remaining: Math.max(0, limit - used),
    retryAfterSeconds: used <= limit ? 0 : remainingTtl,
  };
}

export async function consume(key: string, limit: number, windowSeconds = 60): Promise<LimitResult> {
  const endpoint = redisUnavailableUntil < Date.now() ? redisEndpoint() : null;
  if (!endpoint) return consumeLocal(key, limit, windowSeconds);

  try {
    return await consumeRedis(endpoint, key, limit, windowSeconds);
  } catch (error) {
    if (redisUnavailableUntil === 0) {
      console.warn('[rate-limit] Redis unavailable, counting in-process until it recovers', error);
    }
    redisUnavailableUntil = Date.now() + REDIS_COOLDOWN_MS;
    return consumeLocal(key, limit, windowSeconds);
  }
}

/** Periodic housekeeping so abandoned buckets do not grow without bound. */
if (!('scheduleIdleCleanup' in globalThis)) {
  Object.defineProperty(globalThis, 'scheduleIdleCleanup', { value: true });
  const timer = setInterval(() => {
    const now = Date.now();
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
    if (redisUnavailableUntil && redisUnavailableUntil <= now) redisUnavailableUntil = 0;
  }, 60_000);
  timer.unref?.();
}

/** Best-effort client identity behind a CDN: first XFF entry, else the socket-less fallback. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export const authLimiter = (request: Request, action: string) =>
  consume(`auth:${action}:${clientIp(request)}`, env().AUTH_RATE_LIMIT_PER_MINUTE);

export const otpLimiter = (request: Request, phone: string) =>
  consume(`otp:${phone}:${clientIp(request)}`, 5, 60);

export const checkoutLimiter = (userId: string) => consume(`checkout:${userId}`, 20, 60);
