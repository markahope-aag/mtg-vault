import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  decimal,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ─── REFERENCE LAYER (synced nightly from Scryfall) ─────────────

export const cards = pgTable(
  "cards",
  {
    oracleId: uuid("oracle_id").primaryKey(),
    name: text("name").notNull(),
    manaCost: text("mana_cost"),
    cmc: decimal("cmc", { precision: 4, scale: 1 }),
    typeLine: text("type_line").notNull(),
    oracleText: text("oracle_text"),
    power: text("power"),
    toughness: text("toughness"),
    loyalty: text("loyalty"),
    colors: text("colors").array(),
    colorIdentity: text("color_identity").array(),
    keywords: text("keywords").array(),
    layout: text("layout"),
    cardFaces: jsonb("card_faces"),
    edhrecRank: integer("edhrec_rank"),
    isCommanderLegal: boolean("is_commander_legal").default(true),
    isReservedList: boolean("is_reserved_list").default(false),
    isGameChanger: boolean("is_game_changer").default(false),
    isExtraTurn: boolean("is_extra_turn").default(false),
    isMassLandDenial: boolean("is_mass_land_denial").default(false),
    isTutor: boolean("is_tutor").default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    nameIdx: index("cards_name_idx").on(t.name),
    edhrecRankIdx: index("cards_edhrec_rank_idx").on(t.edhrecRank),
  })
);

export const printings = pgTable(
  "printings",
  {
    id: uuid("id").primaryKey(),
    oracleId: uuid("oracle_id")
      .notNull()
      .references(() => cards.oracleId, { onDelete: "cascade" }),
    setCode: text("set_code").notNull(),
    setName: text("set_name").notNull(),
    collectorNumber: text("collector_number").notNull(),
    rarity: text("rarity"),
    imageUris: jsonb("image_uris"),
    releasedAt: timestamp("released_at"),
    usd: decimal("usd", { precision: 10, scale: 2 }),
    usdFoil: decimal("usd_foil", { precision: 10, scale: 2 }),
    usdEtched: decimal("usd_etched", { precision: 10, scale: 2 }),
    eur: decimal("eur", { precision: 10, scale: 2 }),
    tix: decimal("tix", { precision: 10, scale: 2 }),
    finishes: text("finishes").array(),
    promoTypes: text("promo_types").array(),
    scryfallUri: text("scryfall_uri"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    oracleIdx: index("printings_oracle_id_idx").on(t.oracleId),
    setIdx: index("printings_set_code_idx").on(t.setCode),
  })
);

export const priceHistory = pgTable(
  "price_history",
  {
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    usd: decimal("usd", { precision: 10, scale: 2 }),
    usdFoil: decimal("usd_foil", { precision: 10, scale: 2 }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.printingId, t.date] }),
    dateIdx: index("price_history_date_idx").on(t.date),
  })
);

export const combos = pgTable(
  "combos",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    resultText: text("result_text"),
    pieceCount: integer("piece_count").notNull(),
    colorIdentity: text("color_identity").array(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pieceCountIdx: index("combos_piece_count_idx").on(t.pieceCount),
  })
);

export const comboPieces = pgTable(
  "combo_pieces",
  {
    comboId: text("combo_id")
      .notNull()
      .references(() => combos.id, { onDelete: "cascade" }),
    oracleId: uuid("oracle_id")
      .notNull()
      .references(() => cards.oracleId, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.comboId, t.oracleId] }),
    oracleIdx: index("combo_pieces_oracle_id_idx").on(t.oracleId),
  })
);

// ─── USER LAYER ─────────────────────────────────────────────────

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id),
    // Each row represents ONE physical card. No quantity column.
    foil: boolean("foil").default(false).notNull(),
    etched: boolean("etched").default(false).notNull(),
    condition: text("condition").default("NM").notNull(),
    language: text("language").default("en").notNull(),
    location: text("location"),
    physicalId: text("physical_id"),
    acquiredPrice: decimal("acquired_price", { precision: 10, scale: 2 }),
    acquiredAt: timestamp("acquired_at"),
    purchasedFrom: text("purchased_from"),
    gradingCompany: text("grading_company"),
    grade: text("grade"),
    notes: text("notes"),
    importBatchId: uuid("import_batch_id"),
    // Disposal fields — set when the card is sold/traded/lost. The row is
    // never deleted on disposal so it remains available for historical
    // value/cost-basis tracking.
    disposedTo: text("disposed_to"),
    disposedPrice: decimal("disposed_price", { precision: 10, scale: 2 }),
    disposedAt: timestamp("disposed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    printingIdx: index("inventory_printing_id_idx").on(t.printingId),
    disposedIdx: index("inventory_disposed_at_idx").on(t.disposedAt),
    locationIdx: index("inventory_location_idx").on(t.location),
  })
);

export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  commanderPrintingId: uuid("commander_printing_id").references(
    () => printings.id
  ),
  partnerPrintingId: uuid("partner_printing_id").references(
    () => printings.id
  ),
  targetBracket: integer("target_bracket"),
  archetype: text("archetype"),
  notes: text("notes"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deckCards = pgTable(
  "deck_cards",
  {
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id),
    quantity: integer("quantity").notNull().default(1),
    category: text("category").default("main").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.deckId, t.printingId, t.category] }),
  })
);

export const deckSnapshots = pgTable(
  "deck_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    totalValueUsd: decimal("total_value_usd", { precision: 12, scale: 2 }),
    calculatedBracket: integer("calculated_bracket"),
    bracketReasons: jsonb("bracket_reasons"),
  },
  (t) => ({
    deckIdx: index("deck_snapshots_deck_id_idx").on(t.deckId),
  })
);

// ─── SYNC STATE ─────────────────────────────────────────────────

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── COLLECTION SNAPSHOTS ───────────────────────────────────────

export const collectionSnapshots = pgTable("collection_snapshots", {
  date: text("date").primaryKey(),
  totalCards: integer("total_cards").notNull(),
  marketValueUsd: decimal("market_value_usd", {
    precision: 12,
    scale: 2,
  }).notNull(),
  costBasisUsd: decimal("cost_basis_usd", { precision: 12, scale: 2 }),
  foilCount: integer("foil_count"),
  uniqueCards: integer("unique_cards"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── IMPORT BATCHES ─────────────────────────────────────────────

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    fileHash: text("file_hash").notNull(),
    format: text("format").notNull(),
    totalRows: integer("total_rows").notNull(),
    importedRows: integer("imported_rows").notNull(),
    unmatchedRows: integer("unmatched_rows").notNull(),
    skippedRows: integer("skipped_rows").notNull(),
    defaultLocation: text("default_location"),
    mode: text("mode").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    hashIdx: index("import_batches_hash_idx").on(t.fileHash),
  }),
);
