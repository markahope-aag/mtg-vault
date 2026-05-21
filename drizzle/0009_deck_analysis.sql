-- LLM strategy analysis cache on decks.
-- analysis_signature is a stable hash of the deck card list; when the
-- live signature differs from this value, the cached analysis is stale.
ALTER TABLE "decks"
  ADD COLUMN "analysis" jsonb,
  ADD COLUMN "analysis_model" text,
  ADD COLUMN "analysis_signature" text,
  ADD COLUMN "analyzed_at" timestamp;
