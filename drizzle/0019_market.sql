-- Trades & Market Intelligence Phase B: the market layer schema.
--
-- market_listings — cached listings from external sources. Keyed by
-- (source_id, source_listing_id) so re-fetching the same listing
-- updates rather than duplicating. The bargain detector + valuation
-- views read from here, refreshed daily or on demand.
--
-- wants — manual want-list entries. Want list = (manual entries) ∪
-- (cards the user's decks need but they don't own). The "needed from
-- decks" half derives from the reconcile engine; this table covers
-- "I just want this card" entries that don't tie to a deck.

CREATE TABLE "market_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id" text NOT NULL,
  "source_listing_id" text NOT NULL,
  "oracle_id" uuid REFERENCES "cards"("oracle_id") ON DELETE SET NULL,
  "raw_title" text NOT NULL,
  "set_code" text,
  "condition" text,
  "foil" boolean,
  "price_usd" numeric(10, 2) NOT NULL,
  "shipping_usd" numeric(10, 2),
  "is_sold" boolean NOT NULL DEFAULT false,
  "sold_at" timestamp,
  "url" text NOT NULL,
  "confidence" numeric(3, 2) NOT NULL DEFAULT 1.0,
  "flags" text[],
  "fetched_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp,
  UNIQUE ("source_id", "source_listing_id")
);
ALTER TABLE "market_listings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "market_listings_oracle_idx" ON "market_listings" ("oracle_id");
CREATE INDEX "market_listings_fetched_idx" ON "market_listings" ("fetched_at" DESC);
CREATE INDEX "market_listings_sold_idx" ON "market_listings" ("is_sold", "sold_at" DESC);

CREATE TABLE "wants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "oracle_id" uuid NOT NULL REFERENCES "cards"("oracle_id") ON DELETE CASCADE,
  "target_quantity" integer NOT NULL DEFAULT 1,
  "max_price_usd" numeric(10, 2),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "wants" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "wants_oracle_idx" ON "wants" ("oracle_id");
