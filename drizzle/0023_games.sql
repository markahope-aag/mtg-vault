-- Phase 2: Game result tracking.
--
-- games: one row per real-world game played at a table. The user's deck
-- is the only first-class FK; opponents live in game_players. We keep a
-- myDeckNameSnapshot column so deletion of the deck (ON DELETE SET NULL)
-- doesn't orphan the historical record.
--
-- game_players: one row per seat, including the user. isMe = true on
-- exactly one row per game. commander_oracle_id is the resolved card
-- when the user picked a known commander; commander_name_snapshot
-- preserves what they typed even if resolution failed or the card later
-- got renamed.
--
-- pod_bracket is the Rule-0 agreed level the table sat down to play at,
-- which is DELIBERATELY distinct from the deck's calculated bracket.
-- Stats compare the two (bracket-reality check).

CREATE TABLE "games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "played_at" timestamp NOT NULL,
  "my_deck_id" uuid REFERENCES "decks"("id") ON DELETE SET NULL,
  "my_deck_name_snapshot" text,
  "pod_size" integer,
  "my_finish" integer,
  "won" boolean,
  "pod_bracket" integer,
  "duration_minutes" integer,
  "win_type" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "games_played_at_idx" ON "games" ("played_at" DESC);
CREATE INDEX "games_my_deck_id_idx" ON "games" ("my_deck_id");
CREATE INDEX "games_pod_bracket_idx" ON "games" ("pod_bracket");

CREATE TABLE "game_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
  "is_me" boolean NOT NULL DEFAULT false,
  "player_name" text,
  "commander_oracle_id" uuid REFERENCES "cards"("oracle_id"),
  "commander_name_snapshot" text,
  "finish" integer,
  "knocked_out_by" text
);
ALTER TABLE "game_players" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "game_players_game_id_idx" ON "game_players" ("game_id");
CREATE INDEX "game_players_commander_oracle_idx" ON "game_players" ("commander_oracle_id");
