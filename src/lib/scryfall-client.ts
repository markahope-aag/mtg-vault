// Shared client for api.scryfall.com. Centralizes the polite User-Agent,
// Accept header, the standard "throw on non-ok" behavior, and the rate-limit
// pause between requests so we don't repeat them across three sites
// (scryfall.ts, bracket-flags.ts, search/route.ts).
//
// Scryfall's published etiquette: identify yourself in User-Agent, and
// throttle to ~10 requests/second. SCRYFALL_DELAY_MS is conservative.

const SCRYFALL_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  Accept: "application/json",
} as const;

export const SCRYFALL_DELAY_MS = 100;

export class ScryfallError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`Scryfall ${status} ${statusText}: ${url}`);
    this.name = "ScryfallError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

/**
 * Fetch a Scryfall URL with the standard headers. Throws ScryfallError on
 * any non-2xx response so callers can branch on status if needed
 * (e.g. the search route treats 404 as "no results" rather than an error).
 */
export async function scryfallFetch(url: string | URL): Promise<Response> {
  const u = typeof url === "string" ? url : url.toString();
  const res = await fetch(u, { headers: SCRYFALL_HEADERS });
  if (!res.ok) {
    throw new ScryfallError(res.status, res.statusText, u);
  }
  return res;
}

/** Convenience wrapper for the common "fetch + JSON parse" pattern. */
export async function scryfallJson<T>(url: string | URL): Promise<T> {
  return (await scryfallFetch(url)).json() as Promise<T>;
}

/** Polite pause between Scryfall requests. Centralized so the value can be
 *  tuned in one place if Scryfall changes its rate-limit guidance. */
export function scryfallDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, SCRYFALL_DELAY_MS));
}
