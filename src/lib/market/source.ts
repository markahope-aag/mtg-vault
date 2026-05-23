/**
 * Market source interface — the pluggable abstraction every market feature
 * sits on top of. eBay is the primary implementation; the per-source
 * adapter pattern is here so future targets (a friendly LGS webstore, a
 * specific vendor with an API) can drop in without touching consumers.
 *
 * What this is NOT pointed at: TCGPlayer, Cardmarket, eBay-the-site
 * (scraping). Those are hostile anti-bot targets, their data is their
 * product, and eBay's official API covers the same signal legitimately.
 */

export type MarketListing = {
  /** Which adapter produced this listing. */
  sourceId: string;
  /** Resolved to our card DB. Null when the title can't be matched. */
  oracleId: string | null;
  /** Original listing title — useful for hand-checking confidence. */
  rawTitle: string;
  setCode: string | null;
  /** Normalized to NM/LP/MP/HP/DMG or null when condition isn't clear. */
  condition: string | null;
  foil: boolean | null;
  priceUsd: number;
  shippingUsd: number | null;
  /** true = completed sale (eBay's sold listings = the arbitrage signal).
   *  false = currently active listing. */
  isSold: boolean;
  soldAt: Date | null;
  url: string;
  /** 0-1 confidence in the title→oracle resolution + condition parse. */
  confidence: number;
  /** Diagnostic flags surfaced to the UI so the user can decide whether
   *  to trust a listing or not. */
  flags: MarketListingFlag[];
};

export type MarketListingFlag =
  | "possible_lot"
  | "graded"
  | "language_nonen"
  | "condition_unknown"
  | "altered_artwork"
  | "playtest_proxy";

export type MarketSearchQuery = {
  /** Card name. Required — every source resolves against this. */
  name: string;
  /** Narrow to a specific printing if you care about it. */
  setCode?: string;
  /** Pre-resolved oracle id. When present, the adapter can short-circuit
   *  fuzzy resolution and prefer printings of this card. */
  oracleId?: string;
  /** Cap on returned listings; sources may return fewer. Default 25. */
  limit?: number;
};

export type RateLimit = {
  /** Soft cap — adapters may rate-limit internally if a remote API has
   *  per-minute or per-day quotas. */
  perMinute: number;
  perDay: number;
};

export interface MarketSource {
  /** Stable identifier used for source attribution in cache keys + the
   *  UI. Lowercase, no spaces. */
  id: string;
  /** Human-readable name for the per-source row in /system or /market. */
  displayName: string;
  /** Self-set: false when credentials are missing or the adapter has
   *  been administratively turned off. Consumers MUST check this before
   *  calling search() — disabled sources are still registered (so the UI
   *  can show them as 'configure to enable'), but they shouldn't be
   *  queried. */
  enabled: boolean;
  /** Whether this source returns sold-listing data (the strong arbitrage
   *  signal). Sources that only have active listings still surface in
   *  bargain detection, but the threshold has to use a weaker baseline
   *  (price_history median instead of trailing sold median). */
  hasSoldData: boolean;
  rateLimit: RateLimit;
  search(query: MarketSearchQuery): Promise<MarketListing[]>;
}

/**
 * The registry. Adapters self-register on import; consumers iterate the
 * enabled set. Keeping it dead-simple (no DI, no factory) because we have
 * exactly one source for now and the cost of over-engineering is real.
 */
class MarketSourceRegistry {
  private sources = new Map<string, MarketSource>();

  register(source: MarketSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(
        `MarketSource "${source.id}" is already registered; check for duplicate adapter imports.`,
      );
    }
    this.sources.set(source.id, source);
  }

  all(): MarketSource[] {
    return [...this.sources.values()];
  }

  enabled(): MarketSource[] {
    return this.all().filter((s) => s.enabled);
  }

  get(id: string): MarketSource | undefined {
    return this.sources.get(id);
  }
}

export const marketSources = new MarketSourceRegistry();

// ─── Title heuristics ───────────────────────────────────────────

// Cheap text classifiers used by every adapter for the same flagging
// concerns. Adapters can extend these; the defaults are conservative
// (false negatives over false positives — we'd rather show a clean
// listing the user discovers is a lot than hide a real listing).

const LOT_KEYWORDS = [
  /\blot\b/i,
  /\bbundle\b/i,
  /\bcollection\b/i,
  /\bset\b(?!\s+code)/i, // "set" the word, not "set code"
  /\bx\s*\d+\b/i,
  /\b\d+\s*x\b/i,
  // Match either digit (4 copies) or word (four copies). The word-number
  // pattern was originally restricted to written-out numbers, but real
  // listings just say "4 copies of Sol Ring" — the digit case is the
  // common form.
  /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b\s+(?:copies|cards)\b/i,
];
const GRADED_KEYWORDS = [
  /\bpsa\b/i,
  /\bbgs\b/i,
  /\bcgc\b/i,
  /\bslab\b/i,
  /\bgraded\b/i,
];
const NONEN_KEYWORDS = [
  /\bjapanese\b/i,
  /\bchinese\b/i,
  /\bkorean\b/i,
  /\brussian\b/i,
  /\bgerman\b/i,
  /\bfrench\b/i,
  /\bspanish\b/i,
  /\bitalian\b/i,
  /\bportuguese\b/i,
  // Code-like markers some sellers use:
  /\b(jp|cn|kr|ru|de|fr|es|it|pt)\b/i,
];
const PROXY_KEYWORDS = [/\bproxy\b/i, /\bplaytest\b/i, /\bcustom\b/i];
const ALTERED_KEYWORDS = [/\baltered\b/i, /\bextended\b\s+art/i, /\bborderless\b/i];

export function flagsFromTitle(title: string): MarketListingFlag[] {
  const flags: MarketListingFlag[] = [];
  if (LOT_KEYWORDS.some((re) => re.test(title))) flags.push("possible_lot");
  if (GRADED_KEYWORDS.some((re) => re.test(title))) flags.push("graded");
  if (NONEN_KEYWORDS.some((re) => re.test(title))) flags.push("language_nonen");
  if (PROXY_KEYWORDS.some((re) => re.test(title))) flags.push("playtest_proxy");
  if (ALTERED_KEYWORDS.some((re) => re.test(title))) flags.push("altered_artwork");
  return flags;
}

const CONDITION_PATTERNS: Array<{ re: RegExp; out: string }> = [
  { re: /\bnear\s*mint\b/i, out: "NM" },
  { re: /\bnm\b/i, out: "NM" },
  { re: /\blightly\s*played\b/i, out: "LP" },
  { re: /\blp\b/i, out: "LP" },
  { re: /\bexcellent\b/i, out: "LP" },
  { re: /\bmoderately\s*played\b/i, out: "MP" },
  { re: /\bmp\b/i, out: "MP" },
  { re: /\bvery\s*good\b/i, out: "MP" },
  { re: /\bheavily\s*played\b/i, out: "HP" },
  { re: /\bhp\b/i, out: "HP" },
  { re: /\bpoor\b/i, out: "DMG" },
  { re: /\bdamaged\b/i, out: "DMG" },
];

/**
 * Best-effort normalization. Returns null if the title doesn't carry a
 * condition signal — adapter callers should treat that as
 * condition_unknown rather than guessing NM.
 */
export function normalizeCondition(title: string): string | null {
  for (const { re, out } of CONDITION_PATTERNS) {
    if (re.test(title)) return out;
  }
  return null;
}

export function detectFoilInTitle(title: string): boolean | null {
  // Order matters: "non-foil" contains the substring "foil" that the
  // simple \bfoil\b check matches (- is a non-word char so the boundary
  // is satisfied). Check the negation first.
  if (/\bnon[-\s]?foil\b/i.test(title)) return false;
  if (/\bfoil\b/i.test(title)) return true;
  return null;
}
