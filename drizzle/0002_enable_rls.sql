-- Enable Row Level Security on all public tables.
-- The app accesses these tables via a direct Postgres connection (Drizzle
-- using the `postgres` role), which bypasses RLS as the table owner. RLS
-- with no policies blocks the `anon` and `authenticated` roles entirely,
-- which is what we want — the PostgREST/anon-key surface should never be
-- able to read or write this data.

ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."printings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."combos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."combo_pieces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."decks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deck_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deck_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sync_state" ENABLE ROW LEVEL SECURITY;
