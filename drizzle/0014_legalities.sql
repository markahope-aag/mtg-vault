-- Per-format legality JSON from Scryfall. Backfilled on the next sync.
-- Existing rows stay NULL until then; the card detail UI shows nothing for
-- NULL legalities, which is the desired "data not yet synced" behavior.
ALTER TABLE "public"."cards"
  ADD COLUMN "legalities" jsonb;
