/**
 * Simple in-memory token-bucket rate limiter.
 *
 * DEFENSE-IN-DEPTH — not a substitute for auth or WAF, but stops:
 *   • runaway costs on the LLM endpoints (someone hammering /api/ai/*)
 *   • brute-force attempts on any future auth endpoint
 *   • cron endpoint replay attacks if the CRON_SECRET is leaked
 *
 * LIMITATIONS
 *   • In-memory means per-instance — a scaled deployment across multiple
 *     Vercel/Azure Container App instances will have independent counters.
 *     For serious rate-limiting, swap to Upstash Ratelimit or Azure Cache
 *     for Redis behind the same interface.
 *   • The IP extraction uses x-forwarded-for; behind a WAF/CDN this
 *     should be the real client IP — confirm at deployment.
 *
 * USAGE
 *   const limit = checkRateLimit({ ip, key: 'ai:score-factor', limit: 30, windowMs: 60_000 });
 *   if (!limit.allowed) return new Response('Too many requests', { status: 429 });
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth — sweep expired buckets every 60s.
let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  const iv = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets.entries()) {
      if (b.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  // Never keep the Node process alive just for this.
  if (typeof iv.unref === 'function') iv.unref();
}

export interface RateLimitInput {
  /** Client identifier — normally the request IP. */
  ip: string;
  /** Logical namespace for the counter (e.g. 'ai:score-factor'). */
  key: string;
  /** Max allowed calls per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  ensureSweeper();
  const now = Date.now();
  const bucketKey = `${input.key}::${input.ip}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + input.windowMs });
    return {
      allowed: true,
      remaining: input.limit - 1,
      resetAt: now + input.windowMs,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(0, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: input.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client IP extraction.  Prefers x-forwarded-for's first hop,
 * falls back to a synthetic key so unknown-source requests still get bucketed
 * against each other rather than getting a free pass.
 */
export function ipFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = headers.get('x-real-ip');
  if (real) return real;
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf;
  return 'unknown';
}

/**
 * Format a Response for a rate-limit rejection, matching the RFC 6585
 * Retry-After header pattern.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ ok: false, error: 'Too many requests. Please slow down.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
}
