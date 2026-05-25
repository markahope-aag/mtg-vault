// Tiny in-memory rate limiter for LLM-touching routes.
//
// Scope: this is a single-user app. The point is NOT to defend against
// hostile traffic — the auth proxy + email allowlist do that. The point
// is to catch runaway-loop bugs (a useEffect with the wrong dep array,
// a button without an in-flight guard, a misbehaving cron) before they
// burn through Anthropic credits.
//
// Limits are deliberately generous: well above any realistic human-paced
// usage, low enough that a runaway loop trips within a couple of seconds.
//
// Storage is per-process (a Map). Vercel functions reset on cold start,
// so this is a same-warm-instance guard only. For a personal app that's
// the right ceiling — adding Upstash/Redis for distributed limits would
// be overkill. The Anthropic console budget cap is the out-of-band
// backstop.

type Bucket = {
  /** Window start (ms epoch). Reset when `Date.now() - windowStart >= windowMs`. */
  windowStart: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSec: number; resetAt: number };

/**
 * Increment the counter at `key` and check it against the limit.
 *
 * @param key  Stable per-bucket identifier (e.g. "scan-card", or
 *             `analyze:${deckId}` for per-deck limits).
 * @param limit  Max requests per window.
 * @param windowMs  Window length in ms (default 60_000).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  // Either no bucket yet OR the window has rolled over → fresh window.
  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // In-window. Bump and check.
  existing.count += 1;
  const resetAt = existing.windowStart + windowMs;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt,
    };
  }
  return { ok: true, remaining: Math.max(0, limit - existing.count), resetAt };
}

/** Test helper — reset all buckets. Do not call from production code. */
export function _resetRateLimitsForTests() {
  buckets.clear();
}
