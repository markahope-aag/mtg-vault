-- Per-source config for the scraper adapters (Phase C).
--
-- Each row defines one scrape target. The application code reads these
-- rows at boot and instantiates a ScraperSource per row using the
-- adapter class for parser_template. Code defines parsers; the DB
-- defines targets + their per-source rate limits + their explicit
-- robots/terms acknowledgment.
--
-- robots_acknowledged: the operator promises they've reviewed the
-- target's robots.txt + terms before enabling. A scraper without this
-- flag refuses to run.
--
-- A hostile-marketplace denylist (TCGPlayer / Cardmarket / ebay.com)
-- enforced in code refuses to register adapters for those domains
-- regardless of what's in this table.

CREATE TABLE "market_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable lookup key used in market_listings.source_id + UI URLs.
  "source_key" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "base_url" text NOT NULL,
  -- Parser template: 'shopify' is the common LGS platform. Future
  -- templates: 'woocommerce', 'bigcommerce', 'custom'.
  "parser_template" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  -- Operator promise — UI shouldn't let an adapter enable without this.
  "robots_acknowledged" boolean NOT NULL DEFAULT false,
  "terms_notes" text,
  -- Per-source rate limits. Defaults conservative; admin can tighten.
  "rate_limit_per_minute" integer NOT NULL DEFAULT 5,
  "rate_limit_per_day" integer NOT NULL DEFAULT 200,
  -- Bright Data Web Unlocker on/off per source. Off = plain fetch.
  -- Toggle on for sources behind anti-bot (Cloudflare etc.).
  "use_web_unlocker" boolean NOT NULL DEFAULT false,
  -- Diagnostics surfaced on the admin page.
  "last_run_at" timestamp,
  "last_test_at" timestamp,
  "last_test_ok" boolean,
  "last_test_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "market_sources" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "market_sources_enabled_idx" ON "market_sources" ("enabled");
