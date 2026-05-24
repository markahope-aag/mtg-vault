/**
 * Loads scraper-source rows from market_sources and instantiates an
 * adapter per row using the parser template specified by parserTemplate.
 *
 * Called once at registry boot. The registry is a singleton, so this
 * doesn't need to be re-run on every request — but the source's
 * enabled/disabled state is read from the constructed adapter, which
 * reflects the DB at boot time. Toggling enabled in the admin UI takes
 * effect on the next process boot.
 *
 * (A future improvement: hot-reload sources on enable/disable. For a
 * personal Vercel-deployed app, boot-time loading is fine — function
 * cold starts pick up the latest config.)
 */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { marketSources } from "../../source";
import { isHostileMarketplace } from "./denylist";
import { ShopifyTemplate } from "./templates/shopify";
import type { ScraperSourceConfig } from "./base";

type ParserTemplate = "shopify";

const TEMPLATES: Record<
  ParserTemplate,
  new (c: ScraperSourceConfig) => ShopifyTemplate
> = {
  shopify: ShopifyTemplate,
};

export async function loadScraperSources(): Promise<void> {
  let rows: Array<{
    source_key: string;
    display_name: string;
    base_url: string;
    parser_template: string;
    enabled: boolean;
    robots_acknowledged: boolean;
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    use_web_unlocker: boolean;
  }>;

  try {
    rows = (await db.execute(sql`
      SELECT source_key, display_name, base_url, parser_template, enabled,
             robots_acknowledged, rate_limit_per_minute, rate_limit_per_day,
             use_web_unlocker
      FROM market_sources
    `)) as unknown as typeof rows;
  } catch (err) {
    // Table missing (migration not applied) — log and continue. The
    // app should still boot; we just won't have scraper adapters.
    console.error("[market/scraper] failed to load market_sources:", err);
    return;
  }

  for (const row of rows) {
    // Belt-and-suspenders denylist check — the DB doesn't enforce the
    // denylist, only code does. Skip without throwing so one bad row
    // doesn't block legitimate ones.
    if (isHostileMarketplace(row.base_url)) {
      console.warn(
        `[market/scraper] skipping ${row.source_key} (${row.base_url}) — hostile marketplace denylisted`,
      );
      continue;
    }

    const TemplateClass = TEMPLATES[row.parser_template as ParserTemplate];
    if (!TemplateClass) {
      console.warn(
        `[market/scraper] unknown parser_template "${row.parser_template}" for ${row.source_key}`,
      );
      continue;
    }

    try {
      const adapter = new TemplateClass({
        sourceKey: row.source_key,
        displayName: row.display_name,
        baseUrl: row.base_url,
        enabled: row.enabled,
        robotsAcknowledged: row.robots_acknowledged,
        rateLimitPerMinute: row.rate_limit_per_minute,
        rateLimitPerDay: row.rate_limit_per_day,
        useWebUnlocker: row.use_web_unlocker,
      });
      // Only register once. Multiple module loads (e.g. dev HMR) call
      // here repeatedly; the registry throws on duplicate id, so swallow.
      try {
        marketSources.register(adapter);
      } catch {
        // already registered; nothing to do
      }
    } catch (err) {
      console.error(
        `[market/scraper] failed to register ${row.source_key}:`,
        err,
      );
    }
  }
}

/** Available parser templates surfaced to the admin UI dropdown. */
export const AVAILABLE_PARSER_TEMPLATES: Array<{
  key: ParserTemplate;
  displayName: string;
  description: string;
}> = [
  {
    key: "shopify",
    displayName: "Shopify (/search/suggest.json)",
    description:
      "Most LGS webstores. Uses Shopify's JSON product-suggest endpoint; works without Bright Data for typical friendly targets.",
  },
];
