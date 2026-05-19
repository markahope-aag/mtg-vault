CREATE TABLE "cards" (
	"oracle_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mana_cost" text,
	"cmc" numeric(4, 1),
	"type_line" text NOT NULL,
	"oracle_text" text,
	"power" text,
	"toughness" text,
	"loyalty" text,
	"colors" text[],
	"color_identity" text[],
	"keywords" text[],
	"layout" text,
	"card_faces" jsonb,
	"edhrec_rank" integer,
	"is_commander_legal" boolean DEFAULT true,
	"is_reserved_list" boolean DEFAULT false,
	"is_game_changer" boolean DEFAULT false,
	"is_extra_turn" boolean DEFAULT false,
	"is_mass_land_denial" boolean DEFAULT false,
	"is_tutor" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_pieces" (
	"combo_id" text NOT NULL,
	"oracle_id" uuid NOT NULL,
	CONSTRAINT "combo_pieces_combo_id_oracle_id_pk" PRIMARY KEY("combo_id","oracle_id")
);
--> statement-breakpoint
CREATE TABLE "combos" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"result_text" text,
	"piece_count" integer NOT NULL,
	"color_identity" text[],
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"deck_id" uuid NOT NULL,
	"printing_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"category" text DEFAULT 'main',
	"is_commander" boolean DEFAULT false,
	CONSTRAINT "deck_cards_deck_id_printing_id_category_pk" PRIMARY KEY("deck_id","printing_id","category")
);
--> statement-breakpoint
CREATE TABLE "deck_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	"total_value_usd" numeric(12, 2),
	"calculated_bracket" integer,
	"bracket_reasons" jsonb
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"commander_printing_id" uuid,
	"partner_printing_id" uuid,
	"target_bracket" integer,
	"archetype" text,
	"notes" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printing_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"foil" boolean DEFAULT false,
	"etched" boolean DEFAULT false,
	"condition" text DEFAULT 'NM',
	"language" text DEFAULT 'en',
	"location" text,
	"acquired_price" numeric(10, 2),
	"acquired_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"printing_id" uuid NOT NULL,
	"date" text NOT NULL,
	"usd" numeric(10, 2),
	"usd_foil" numeric(10, 2),
	CONSTRAINT "price_history_printing_id_date_pk" PRIMARY KEY("printing_id","date")
);
--> statement-breakpoint
CREATE TABLE "printings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid NOT NULL,
	"set_code" text NOT NULL,
	"set_name" text NOT NULL,
	"collector_number" text NOT NULL,
	"rarity" text,
	"image_uris" jsonb,
	"released_at" timestamp,
	"usd" numeric(10, 2),
	"usd_foil" numeric(10, 2),
	"usd_etched" numeric(10, 2),
	"eur" numeric(10, 2),
	"tix" numeric(10, 2),
	"finishes" text[],
	"promo_types" text[],
	"scryfall_uri" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "combo_pieces" ADD CONSTRAINT "combo_pieces_combo_id_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_pieces" ADD CONSTRAINT "combo_pieces_oracle_id_cards_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."cards"("oracle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_snapshots" ADD CONSTRAINT "deck_snapshots_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_commander_printing_id_printings_id_fk" FOREIGN KEY ("commander_printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_partner_printing_id_printings_id_fk" FOREIGN KEY ("partner_printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_printing_id_printings_id_fk" FOREIGN KEY ("printing_id") REFERENCES "public"."printings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printings" ADD CONSTRAINT "printings_oracle_id_cards_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."cards"("oracle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_name_idx" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cards_edhrec_rank_idx" ON "cards" USING btree ("edhrec_rank");--> statement-breakpoint
CREATE INDEX "combo_pieces_oracle_id_idx" ON "combo_pieces" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "combos_piece_count_idx" ON "combos" USING btree ("piece_count");--> statement-breakpoint
CREATE INDEX "deck_snapshots_deck_id_idx" ON "deck_snapshots" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "inventory_printing_id_idx" ON "inventory" USING btree ("printing_id");--> statement-breakpoint
CREATE INDEX "price_history_date_idx" ON "price_history" USING btree ("date");--> statement-breakpoint
CREATE INDEX "printings_oracle_id_idx" ON "printings" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "printings_set_code_idx" ON "printings" USING btree ("set_code");