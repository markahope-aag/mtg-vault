-- Trade tracker. A trade is one event between you and a partner: some cards
-- go out, some come in. We tag both directions onto inventory rows via
-- trade_id (same shape as import_batches): outgoing rows are the existing
-- inventory rows marked disposed at submit time; incoming rows are new
-- inventory rows created with purchased_from = "Trade: {partner}".

CREATE TABLE "trades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner" text NOT NULL,
  "traded_at" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "trades_partner_idx" ON "trades" ("partner");
CREATE INDEX "trades_traded_at_idx" ON "trades" ("traded_at" DESC);

ALTER TABLE "inventory" ADD COLUMN "trade_id" uuid REFERENCES "trades"("id") ON DELETE SET NULL;
CREATE INDEX "inventory_trade_id_idx" ON "inventory" ("trade_id") WHERE "trade_id" IS NOT NULL;
