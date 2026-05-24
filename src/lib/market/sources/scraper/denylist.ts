/**
 * Hostile-marketplace denylist.
 *
 * Refuses to register a scraper adapter targeting one of these domains.
 * The reasoning is explicit in the error message: these sites are
 * anti-bot-hostile, their pricing data is their commercial product, and
 * scraping them is the exact use their terms prohibit. eBay is on the
 * list because the official Browse API covers the same signal
 * legitimately — there's never a reason to scrape the website.
 *
 * To add a new entry: be sure you're not just papering over a friendly
 * target that happens to use Cloudflare. The list is intentionally short.
 */

const HOSTILE_MARKETPLACE_DOMAINS = new Set([
  // The big card marketplaces — their data is their product.
  "tcgplayer.com",
  "magic.tcgplayer.com",
  "shop.tcgplayer.com",
  "cardmarket.com",
  "www.cardmarket.com",
  // eBay site — use the eBay API adapter instead.
  "ebay.com",
  "www.ebay.com",
  "ebay.co.uk",
  // Big aggregator-style scrape targets aren't worth the legal risk.
  "mtgstocks.com",
]);

export class HostileMarketplaceError extends Error {
  constructor(hostname: string) {
    const note =
      hostname.endsWith("ebay.com") || hostname.endsWith("ebay.co.uk")
        ? " Use the eBay Browse API adapter (sources/ebay.ts) instead."
        : "";
    super(
      `Scraper adapters cannot target "${hostname}" — it's an anti-bot-` +
        `hostile marketplace whose terms explicitly prohibit scraping its ` +
        `commercial pricing data.${note}`,
    );
    this.name = "HostileMarketplaceError";
  }
}

/**
 * Throws HostileMarketplaceError if the URL's hostname matches a denylisted
 * marketplace. Called from the ScraperSource constructor so registering a
 * forbidden target fails loudly at boot rather than silently shipping.
 */
export function assertNotHostileMarketplace(baseUrl: string): void {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    // If the URL doesn't parse, leave it to the adapter to error on actual
    // use — we don't want denylist enforcement to be the place that
    // crashes on malformed input.
    return;
  }
  const canonical = hostname.replace(/^www\./, "");
  if (
    HOSTILE_MARKETPLACE_DOMAINS.has(hostname) ||
    HOSTILE_MARKETPLACE_DOMAINS.has(canonical)
  ) {
    throw new HostileMarketplaceError(canonical);
  }
}

/** Exposed for tests + the admin UI's pre-create check. */
export function isHostileMarketplace(baseUrl: string): boolean {
  try {
    assertNotHostileMarketplace(baseUrl);
    return false;
  } catch {
    return true;
  }
}
