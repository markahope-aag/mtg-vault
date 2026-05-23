/**
 * eBay adapter.
 *
 * Uses eBay's official Browse API for active listings. Sold/completed data
 * comes from the Marketplace Insights API where the dev account has been
 * approved for it; without that approval, the bargain detector falls back
 * to price_history medians as the baseline instead of trailing sold price.
 *
 * Why eBay and not TCGPlayer / Cardmarket / scraping eBay HTML:
 *   - eBay's official API is free, durable, ToS-permitted, and returns
 *     both active + sold (the arbitrage signal).
 *   - TCGPlayer and Cardmarket are hostile anti-bot targets and their
 *     pricing data is their product. Scraping them is the exact use
 *     their terms prohibit.
 *
 * Credentials: this adapter requires three env vars to enable:
 *   EBAY_APP_ID    — OAuth app client ID
 *   EBAY_CERT_ID   — OAuth app client secret
 *   EBAY_OAUTH_TOKEN — pre-fetched application token (or we'll exchange
 *                     a refresh token at request time; for v1 we expect
 *                     a server-side cached token refreshed by a cron).
 *
 * When any of those are missing, the adapter registers as disabled. The
 * Bargain detector iterates enabled sources and gets an empty list,
 * which the UI surfaces as "configure eBay to enable" rather than
 * pretending nothing was wrong.
 */
import {
  detectFoilInTitle,
  flagsFromTitle,
  marketSources,
  normalizeCondition,
  type MarketListing,
  type MarketSearchQuery,
  type MarketSource,
} from "../source";

const SOURCE_ID = "ebay";
const BROWSE_API = "https://api.ebay.com/buy/browse/v1";

// MTG category id on eBay (Trading Card Games > Magic). Filters our
// queries down to MTG so we don't drag in card games with overlapping
// card names. Listed in eBay's category tree.
const MTG_CATEGORY_ID = "38292";

// Cap the results per call; the Browse API supports up to 200 per page.
const DEFAULT_LIMIT = 25;

function hasCredentials(): boolean {
  return !!(
    process.env.EBAY_APP_ID &&
    process.env.EBAY_CERT_ID &&
    process.env.EBAY_OAUTH_TOKEN
  );
}

class EbayAdapter implements MarketSource {
  id = SOURCE_ID;
  displayName = "eBay";
  enabled = hasCredentials();
  // hasSoldData stays false until Marketplace Insights is wired. The
  // adapter still returns active listings via Browse; the bargain
  // detector treats this as "no sold baseline, fall back to
  // price_history median."
  hasSoldData = false;
  rateLimit = {
    // Browse API allows ~5k calls/day by default for production keys.
    // Throttle ourselves well under that — a personal app should never
    // need more than a few hundred a day with the cache layer.
    perMinute: 30,
    perDay: 1000,
  };

  async search(query: MarketSearchQuery): Promise<MarketListing[]> {
    if (!this.enabled) return [];

    // Build the Browse API query. Bias toward single-card raw listings:
    //   - exclude lots/bundles in the query string (eBay's filter syntax)
    //   - exclude graded slabs
    //   - restrict to MTG category
    //   - prefer USD pricing
    const q = [
      query.name,
      query.setCode ? `(${query.setCode})` : "",
      "-lot -bundle -collection -psa -bgs -cgc -slab -graded",
    ]
      .filter(Boolean)
      .join(" ");
    const url = new URL(`${BROWSE_API}/item_summary/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("category_ids", MTG_CATEGORY_ID);
    url.searchParams.set("limit", String(query.limit ?? DEFAULT_LIMIT));
    // Restrict to BIN listings ($price visible) + USD currency.
    url.searchParams.set(
      "filter",
      [
        "buyingOptions:{FIXED_PRICE}",
        "priceCurrency:USD",
        "deliveryCountry:US",
      ].join(","),
    );

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.EBAY_OAUTH_TOKEN}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
          Accept: "application/json",
        },
      });
    } catch (err) {
      console.error("[market/ebay] fetch failed:", err);
      return [];
    }
    if (!response.ok) {
      // 401 → token expired; the bargain detector will surface the empty
      // result and we log so the operator can investigate. Don't throw —
      // a single source's failure shouldn't break the whole bargain
      // sweep.
      console.error(
        `[market/ebay] HTTP ${response.status} ${response.statusText} for ${q}`,
      );
      return [];
    }

    const body = (await response.json()) as {
      itemSummaries?: EbayItemSummary[];
    };
    const items = body.itemSummaries ?? [];

    return items
      .map((item) => mapItem(item, query.oracleId ?? null))
      .filter((l): l is MarketListing => l !== null);
  }
}

type EbayItemSummary = {
  itemId: string;
  title: string;
  itemWebUrl: string;
  price?: { value: string; currency: string };
  shippingOptions?: Array<{
    shippingCost?: { value: string; currency: string };
  }>;
  condition?: string;
  itemEndDate?: string; // for active listings, when they expire
};

function mapItem(
  item: EbayItemSummary,
  oracleIdHint: string | null,
): MarketListing | null {
  const price = Number.parseFloat(item.price?.value ?? "0");
  if (!Number.isFinite(price) || price <= 0) return null;
  const shipping =
    item.shippingOptions?.[0]?.shippingCost?.value != null
      ? Number.parseFloat(item.shippingOptions[0].shippingCost!.value)
      : null;

  const titleFlags = flagsFromTitle(item.title);
  const condition =
    normalizeCondition(item.title) ?? normalizeCondition(item.condition ?? "");

  // Confidence heuristic. The strongest signal is having a clean
  // single-card title with a recognizable condition string; lots /
  // grades / non-English cuts the score significantly.
  let confidence = 0.7;
  if (titleFlags.includes("possible_lot")) confidence -= 0.3;
  if (titleFlags.includes("graded")) confidence -= 0.2;
  if (titleFlags.includes("language_nonen")) confidence -= 0.2;
  if (titleFlags.includes("playtest_proxy")) confidence -= 0.5;
  if (condition == null) confidence -= 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    sourceId: SOURCE_ID,
    oracleId: oracleIdHint, // resolution happens at the consumer layer
    rawTitle: item.title,
    setCode: null, // would need parsing from title; left for the consumer
    condition,
    foil: detectFoilInTitle(item.title),
    priceUsd: price,
    shippingUsd: shipping,
    isSold: false, // Browse API = active listings only
    soldAt: null,
    url: item.itemWebUrl,
    confidence,
    flags: condition == null ? [...titleFlags, "condition_unknown"] : titleFlags,
  };
}

marketSources.register(new EbayAdapter());
