-- Enable pg_trgm so we can do fuzzy + prefix matching on card names from the
-- /api/search endpoint without round-tripping to Scryfall for the common case.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on cards.name powers both similarity() and ILIKE '...%'
-- lookups. This is the single most important index for the search UX.
CREATE INDEX IF NOT EXISTS cards_name_trgm_idx
  ON "public"."cards" USING gin (name gin_trgm_ops);
