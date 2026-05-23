-- Rogue Deck Builder, Phase A.
-- deck_proposals stores transient AI generations the user reviews BEFORE
-- committing to a real deck. They do NOT count as deck_commitments for
-- contested-card math unless the user explicitly saves one as a deck
-- (saved_deck_id then links to the resulting decks.id).

CREATE TABLE "deck_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,                  -- 'standard' | 'rogue'
  "commander_oracle_id" uuid,
  "partner_oracle_id" uuid,
  "target_bracket" integer,
  "archetype_brief" text,                -- user's playstyle input, if any
  "status" text NOT NULL,                -- 'generating' | 'ready' | 'failed' | 'saved'
  "card_list" jsonb,                     -- resolved oracle ids + names + roles
  "analysis" jsonb,                      -- DeckAnalysis (reused type from strategy.ts)
  "rogue_rationale" jsonb,               -- null for standard
  "critique" jsonb,                      -- null for standard
  "generation_log" jsonb,                -- pass-by-pass record for debugging
  "model" text,
  "saved_deck_id" uuid REFERENCES "decks"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "deck_proposals" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "deck_proposals_status_idx" ON "deck_proposals" ("status");
CREATE INDEX "deck_proposals_created_at_idx" ON "deck_proposals" ("created_at" DESC);
