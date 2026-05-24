/**
 * ScraperSource — abstract base class every scraper adapter extends.
 *
 * The pattern: code defines parsers (one subclass per parserTemplate);
 * the market_sources DB row picks which parser + provides the baseUrl,
 * rate limits, robots-acknowledgment, and feature flags. Instances are
 * built at boot from the DB rows by loadScraperSources().
 *
 * Adapters MUST:
 *   - implement parseListings(html, query) — parse a search-page
 *     response into MarketListing[]
 *   - implement buildSearchUrl(query) — turn a card query into a URL
 *   - call assertNotHostileMarketplace(baseUrl) in their constructor
 *     (the base class does it for them)
 *
 * Adapters MUST NOT throw on parse errors — bad data is worse than none.
 * Surface failures via the empty-array return + console.error.
 */

import { scrapeFetch, configureLimiter } from "./runtime";
import { assertNotHostileMarketplace } from "./denylist";
import {
  flagsFromTitle,
  type MarketListing,
  type MarketSearchQuery,
  type MarketSource,
  type RateLimit,
} from "../../source";

export type ScraperSourceConfig = {
  sourceKey: string;
  displayName: string;
  baseUrl: string;
  enabled: boolean;
  robotsAcknowledged: boolean;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  useWebUnlocker: boolean;
};

export abstract class ScraperSource implements MarketSource {
  public readonly id: string;
  public readonly displayName: string;
  public readonly baseUrl: string;
  /** Enabled requires both the operator flag AND the robots/terms
   *  acknowledgment. UI shouldn't let one go without the other; the
   *  base class enforces it again here belt-and-suspenders. */
  public readonly enabled: boolean;
  /** Set by subclasses if they have a sold-data feed. Scraper-based
   *  LGS sources are active-listings only; the value is false here by
   *  default. */
  public readonly hasSoldData: boolean = false;
  public readonly rateLimit: RateLimit;
  public readonly useWebUnlocker: boolean;

  constructor(config: ScraperSourceConfig) {
    // Hard refusal for hostile marketplaces. Throws if the baseUrl
    // matches the denylist; an adapter for tcgplayer.com cannot
    // construct, regardless of what's in the DB.
    assertNotHostileMarketplace(config.baseUrl);

    this.id = config.sourceKey;
    this.displayName = config.displayName;
    this.baseUrl = config.baseUrl;
    this.useWebUnlocker = config.useWebUnlocker;
    this.rateLimit = {
      perMinute: config.rateLimitPerMinute,
      perDay: config.rateLimitPerDay,
    };
    this.enabled = config.enabled && config.robotsAcknowledged;

    // Configure the rate limiter for this source key. Subsequent
    // configureLimiter calls with the same params are idempotent.
    configureLimiter(this.id, this.rateLimit);
  }

  /** Subclasses build a search URL targeting this source. */
  protected abstract buildSearchUrl(query: MarketSearchQuery): string;

  /**
   * Subclasses parse the fetched body into MarketListing[]. They MUST
   * NOT throw — return [] on parse failure and log.
   * - rawBody: the response body string (HTML or JSON depending on
   *   the source).
   * - query: the original search so the adapter can stamp oracleId
   *   onto listings.
   */
  protected abstract parseListings(
    rawBody: string,
    query: MarketSearchQuery,
  ): MarketListing[];

  async search(query: MarketSearchQuery): Promise<MarketListing[]> {
    if (!this.enabled) return [];
    const url = this.buildSearchUrl(query);
    const result = await scrapeFetch({
      url,
      sourceKey: this.id,
      useWebUnlocker: this.useWebUnlocker,
    });
    if (!result.ok) {
      console.error(
        `[market/${this.id}] fetch failed: HTTP ${result.status} — ${result.error}`,
      );
      return [];
    }
    try {
      return this.parseListings(result.body, query);
    } catch (err) {
      console.error(`[market/${this.id}] parse failed:`, err);
      return [];
    }
  }

  /**
   * Helper for subclasses: build a baseline listing with flags inferred
   * from the title. Subclasses fill in price, url, and optional
   * confidence adjustments.
   */
  protected buildListing(input: {
    sourceListingId: string;
    title: string;
    priceUsd: number;
    shippingUsd: number | null;
    url: string;
    condition?: string | null;
    foil?: boolean | null;
    setCode?: string | null;
    oracleIdHint: string | null;
    /** Subtract more or less confidence based on adapter-specific
     *  signals (e.g. the listing was on the "deals" page, or the
     *  source historically misclassifies). Default 0.7. */
    baseConfidence?: number;
  }): MarketListing {
    const flags = flagsFromTitle(input.title);
    let confidence = input.baseConfidence ?? 0.7;
    if (flags.includes("possible_lot")) confidence -= 0.3;
    if (flags.includes("graded")) confidence -= 0.2;
    if (flags.includes("language_nonen")) confidence -= 0.2;
    if (flags.includes("playtest_proxy")) confidence -= 0.5;
    if (!input.condition) {
      confidence -= 0.1;
      flags.push("condition_unknown");
    }
    confidence = Math.max(0, Math.min(1, confidence));
    return {
      sourceId: this.id,
      oracleId: input.oracleIdHint,
      rawTitle: input.title,
      setCode: input.setCode ?? null,
      condition: input.condition ?? null,
      foil: input.foil ?? null,
      priceUsd: input.priceUsd,
      shippingUsd: input.shippingUsd,
      isSold: false,
      soldAt: null,
      url: input.url,
      confidence,
      flags,
    };
  }
}
