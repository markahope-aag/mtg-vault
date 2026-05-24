/**
 * Scraper runtime — the fetch wrapper used by every ScraperSource adapter.
 *
 * Two fetch modes:
 *   - plain fetch (default): works for friendly LGS targets without
 *     anti-bot. Free. Sends a polite User-Agent identifying the app.
 *   - Bright Data Web Unlocker (opt-in per source via the
 *     market_sources.use_web_unlocker flag): paid, captcha-solving
 *     proxy for sites behind Cloudflare etc. Only enable per-source
 *     after confirming the target is one you have a legit reason to
 *     fetch (you buy there, not arbitrage scraping).
 *
 * Includes:
 *   - per-source token-bucket rate limiter (perMinute, perDay)
 *   - retry with exponential backoff (3 attempts, 1s/2s/4s)
 *   - 30s timeout per attempt
 *
 * The pattern was lifted from markahope-aag/asymmetric-web-scraper's
 * lib/scrapers/web-unlocker.ts — same Bright Data integration shape,
 * adapted for our per-source rate limit + retry needs.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { marketSourcesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const USER_AGENT = "MTG-Vault/0.1 (personal collection management)";
const BRIGHT_DATA_ENDPOINT = "https://api.brightdata.com/request";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export type FetchOptions = {
  url: string;
  /** Which market_sources row pays the rate-limit budget. */
  sourceKey: string;
  useWebUnlocker: boolean;
  timeoutMs?: number;
  /** Extra headers passed to the underlying fetch / Bright Data request. */
  headers?: Record<string, string>;
};

export type FetchResult =
  | { ok: true; status: number; body: string; url: string }
  | { ok: false; status: number; error: string; url: string };

/**
 * Per-source token bucket. In-memory; reset on process restart. Good
 * enough for a personal app — if we ever wanted persistent rate limits
 * we'd back this with Redis or a DB counter table. The market_sources
 * table tracks last_run_at separately for the UI.
 */
class RateLimiter {
  private minuteWindow: number[] = [];
  private dayWindow: number[] = [];

  constructor(
    private readonly perMinute: number,
    private readonly perDay: number,
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.minuteWindow = this.minuteWindow.filter((t) => now - t < 60_000);
    this.dayWindow = this.dayWindow.filter((t) => now - t < 86_400_000);

    if (this.dayWindow.length >= this.perDay) {
      throw new Error(
        `Per-day rate limit (${this.perDay}) exceeded; refusing to fetch.`,
      );
    }
    if (this.minuteWindow.length >= this.perMinute) {
      // Wait until the oldest minute-window entry rolls off.
      const oldest = this.minuteWindow[0];
      const waitMs = 60_000 - (now - oldest) + 50; // tiny buffer
      await new Promise((r) => setTimeout(r, waitMs));
      return this.acquire();
    }
    this.minuteWindow.push(now);
    this.dayWindow.push(now);
  }
}

// One limiter per source. Constructed lazily; rate-limit params are read
// from the source's market_sources row on first acquire.
const limiters = new Map<string, RateLimiter>();
const limiterParams = new Map<string, { perMinute: number; perDay: number }>();

export function configureLimiter(
  sourceKey: string,
  params: { perMinute: number; perDay: number },
): void {
  // If params changed (admin tightened the limit), rebuild the limiter.
  const existing = limiterParams.get(sourceKey);
  if (
    !existing ||
    existing.perMinute !== params.perMinute ||
    existing.perDay !== params.perDay
  ) {
    limiters.set(sourceKey, new RateLimiter(params.perMinute, params.perDay));
    limiterParams.set(sourceKey, params);
  }
}

function getLimiter(sourceKey: string): RateLimiter {
  let limiter = limiters.get(sourceKey);
  if (!limiter) {
    // Defensive fallback — should always be configured before use.
    limiter = new RateLimiter(5, 200);
    limiters.set(sourceKey, limiter);
  }
  return limiter;
}

async function withTimeout(
  promise: Promise<Response>,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(id);
  }
}

async function plainFetch(opts: FetchOptions): Promise<Response> {
  return fetch(opts.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json",
      ...opts.headers,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
}

async function brightDataFetch(opts: FetchOptions): Promise<Response> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const zone = process.env.BRIGHTDATA_ZONE ?? "web_unlocker1";
  if (!token) {
    throw new Error(
      "BRIGHTDATA_API_TOKEN is not set. Add it to .env.local (and configure a Bright Data Web Unlocker zone) to use scraper sources with use_web_unlocker = true.",
    );
  }
  return withTimeout(
    fetch(BRIGHT_DATA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone,
        url: opts.url,
        format: "raw",
      }),
    }),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
}

/**
 * Single fetch with rate limit + retry. Adapters call this per page
 * they want; they don't need to know whether the source is using
 * plain fetch or Bright Data.
 *
 * Failures are surfaced as { ok: false, status, error } — adapters
 * should treat them as empty results and log, NOT throw. Bad scrape
 * data is worse than none; a failed fetch returning an empty array
 * is the correct quiet failure mode.
 */
export async function scrapeFetch(opts: FetchOptions): Promise<FetchResult> {
  const limiter = getLimiter(opts.sourceKey);

  let lastError = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s.
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    try {
      await limiter.acquire();
      const response =
        opts.useWebUnlocker ? await brightDataFetch(opts) : await plainFetch(opts);
      lastStatus = response.status;
      if (!response.ok) {
        // 4xx is permanent; don't retry. 5xx + 429 retry through the loop.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return {
            ok: false,
            status: response.status,
            error: `HTTP ${response.status} ${response.statusText}`,
            url: opts.url,
          };
        }
        lastError = `HTTP ${response.status} ${response.statusText}`;
        continue;
      }
      const body = await response.text();
      // Record activity in the source row asynchronously — don't block
      // the fetch on the DB write.
      void touchLastRunAt(opts.sourceKey);
      return { ok: true, status: response.status, body, url: opts.url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Network/timeout errors retry; rate-limit-exceeded errors stop
      // the chain because retrying won't help.
      if (lastError.includes("Per-day rate limit")) {
        return { ok: false, status: 0, error: lastError, url: opts.url };
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    error: lastError || "Unknown fetch failure",
    url: opts.url,
  };
}

async function touchLastRunAt(sourceKey: string): Promise<void> {
  try {
    await db
      .update(marketSourcesTable)
      .set({ lastRunAt: sql`now()` })
      .where(eq(marketSourcesTable.sourceKey, sourceKey));
  } catch {
    // Diagnostic-only write; never break a successful scrape because
    // we couldn't update the timestamp.
  }
}
