/**
 * Shopify parser template.
 *
 * Most LGS webstores run on Shopify. Shopify exposes a JSON product
 * search at /search/suggest.json that returns structured data, so we
 * don't need to scrape HTML at all — a plain fetch works without
 * Bright Data for most friendly targets.
 *
 * Output shape (abridged from Shopify's API):
 *   {
 *     resources: {
 *       results: {
 *         products: [{ title, url, price, image, ... }]
 *       }
 *     }
 *   }
 *
 * If a particular LGS doesn't expose this endpoint, the template
 * silently returns empty — the admin page's "test fetch" surface
 * makes that visible so the operator can pick a different template
 * or write a custom parser.
 *
 * Important: prices come back in the store's currency. We assume USD
 * (US LGSs); a future per-source currency setting would let UK/CA
 * stores work too.
 */

import { ScraperSource, type ScraperSourceConfig } from "../base";
import {
  detectFoilInTitle,
  normalizeCondition,
  type MarketListing,
  type MarketSearchQuery,
} from "../../../source";

type ShopifySuggestResponse = {
  resources?: {
    results?: {
      products?: Array<{
        title: string;
        url: string;
        price?: string;
        image?: string;
        vendor?: string;
        available?: boolean;
        product_id?: number;
      }>;
    };
  };
};

export class ShopifyTemplate extends ScraperSource {
  constructor(config: ScraperSourceConfig) {
    super(config);
  }

  protected buildSearchUrl(query: MarketSearchQuery): string {
    // Shopify's suggestion endpoint. ?q={name}&resources[type]=product
    // restricts to products (not articles or pages). Limit caps the
    // results in the JSON; we pass a generous 25 since the adapter's
    // own filtering drops most of them.
    const params = new URLSearchParams({
      q: query.name,
      "resources[type]": "product",
      "resources[limit]": String(query.limit ?? 25),
    });
    return `${this.baseUrl.replace(/\/$/, "")}/search/suggest.json?${params.toString()}`;
  }

  protected parseListings(
    rawBody: string,
    query: MarketSearchQuery,
  ): MarketListing[] {
    let parsed: ShopifySuggestResponse;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // Body wasn't JSON — the store probably doesn't expose
      // /search/suggest.json. Return empty; the admin "test fetch"
      // result will surface the issue.
      return [];
    }

    const products = parsed.resources?.results?.products ?? [];
    const listings: MarketListing[] = [];

    for (const p of products) {
      if (!p.title || !p.url) continue;
      const priceUsd = parsePrice(p.price);
      if (priceUsd == null || priceUsd <= 0) continue;
      // available === false → not currently in stock; skip.
      if (p.available === false) continue;

      // Filter: require the product title to contain the queried name.
      // Shopify search is fuzzy and will return adjacent matches (a
      // playmat with "Sol Ring" in the description) — title-contains
      // is a cheap precision filter.
      if (!p.title.toLowerCase().includes(query.name.toLowerCase())) {
        continue;
      }

      const fullUrl = p.url.startsWith("http")
        ? p.url
        : `${this.baseUrl.replace(/\/$/, "")}${p.url}`;

      listings.push(
        this.buildListing({
          sourceListingId: String(p.product_id ?? p.url),
          title: p.title,
          priceUsd,
          shippingUsd: null, // Shopify suggest doesn't return shipping
          url: fullUrl,
          condition: normalizeCondition(p.title),
          foil: detectFoilInTitle(p.title),
          oracleIdHint: query.oracleId ?? null,
        }),
      );
    }

    return listings;
  }
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  // Shopify returns "$12.50" or "12.50" depending on theme config.
  // Strip non-numeric except decimal.
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
