-- Per-day collection snapshots feed the dashboard's value-over-time chart.
-- Primary key on date keeps the daily cron idempotent (UPSERT, never duplicate
-- rows for the same day).

CREATE TABLE IF NOT EXISTS "public"."collection_snapshots" (
  "date"              text PRIMARY KEY,
  "total_cards"       integer NOT NULL,
  "market_value_usd"  numeric(12,2) NOT NULL,
  "cost_basis_usd"    numeric(12,2),
  "foil_count"        integer,
  "unique_cards"      integer,
  "created_at"        timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "public"."collection_snapshots" ENABLE ROW LEVEL SECURITY;
