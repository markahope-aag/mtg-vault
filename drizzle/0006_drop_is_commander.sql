-- The commander is identified by decks.commander_printing_id (and
-- decks.partner_printing_id), so the per-row is_commander flag was a
-- redundant second source of truth.

ALTER TABLE "public"."deck_cards" DROP COLUMN IF EXISTS "is_commander";
