-- Trades & Market Intelligence Phase A: double-sided transaction ledger.
--
-- transactions groups one or more inventory movements into a real-world
-- event. Purchase: 1..N 'in' lines. Sale: 1..N 'out' lines. Trade: both
-- (with optional cash legs on either side).
--
-- transaction_lines links inventory rows to a transaction with a per-line
-- allocated cost/proceeds and a snapshot of the printing's market value at
-- transaction time (used for cost-basis allocation + retro fairness math).
--
-- inventory.transaction_id is the FK that drives the join. The existing
-- inventory.disposed_* + acquired_* fields remain canonical — transactions
-- WRITE those fields, they don't replace them. ON DELETE SET NULL so
-- deleting a transaction doesn't cascade and wipe inventory rows.

CREATE TABLE "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL CHECK ("kind" IN ('purchase', 'sale', 'trade')),
  "occurred_at" timestamp NOT NULL,
  "counterparty" text,
  "channel" text,
  "cash_out_usd" numeric(10, 2),
  "cash_in_usd" numeric(10, 2),
  "fees_usd" numeric(10, 2),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "transactions_kind_idx" ON "transactions" ("kind");
CREATE INDEX "transactions_occurred_at_idx" ON "transactions" ("occurred_at" DESC);
CREATE INDEX "transactions_counterparty_idx" ON "transactions" ("counterparty");

CREATE TABLE "transaction_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "inventory_id" uuid REFERENCES "inventory"("id") ON DELETE SET NULL,
  "direction" text NOT NULL CHECK ("direction" IN ('in', 'out')),
  "printing_id" uuid NOT NULL REFERENCES "printings"("id"),
  "allocated_value_usd" numeric(10, 2),
  "market_value_at_time_usd" numeric(10, 2)
);
ALTER TABLE "transaction_lines" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "transaction_lines_transaction_id_idx" ON "transaction_lines" ("transaction_id");
CREATE INDEX "transaction_lines_inventory_id_idx" ON "transaction_lines" ("inventory_id");

ALTER TABLE "inventory"
  ADD COLUMN "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL;
CREATE INDEX "inventory_transaction_id_idx"
  ON "inventory" ("transaction_id")
  WHERE "transaction_id" IS NOT NULL;
