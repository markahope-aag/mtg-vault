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
    // precision 12 — un-set cards like Gleemax have CMC 1,000,000, which
    // overflows the original numeric(4,1). scale 1 keeps half-mana (e.g.
    // Little Girl's {1/2}) representable.
    cmc: decimal("cmc", { precision: 12, scale: 1 }),
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
    // Per-format legality map from Scryfall (e.g. { standard: "legal",
    // modern: "legal", commander: "banned", … }). Source of truth for
    // surfacing format badges on the card detail page; isCommanderLegal
    // is kept as a denormalized boolean for cheap hot-path filters.
    legalities: jsonb("legalities").$type<Record<string, string>>(),
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
    // Per-face data for double-faced cards (image_uris[0]/[1] etc.). Top-level
    // image_uris is null for DFCs — the face art lives here.
    cardFaces: jsonb("card_faces"),
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

// combos / combo_pieces were dropped in migration 0013. No sync was ever
// written — Spellbook is consumed live from the API in src/lib/spellbook.ts.

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
    // Transaction tag (Phase A of the ledger). Every purchase / sale /
    // trade writes both this and the canonical inventory.acquired_* /
    // disposed_* fields on the row.
    transactionId: uuid("transaction_id"),
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
  // LLM strategy analysis — JSON shape defined by src/lib/ai/strategy.ts.
  // analysisSignature is a hash of the sorted printing IDs so we can detect
  // when the deck has drifted since the cached analysis was generated.
  analysis: jsonb("analysis"),
  analysisModel: text("analysis_model"),
  analysisSignature: text("analysis_signature"),
  analyzedAt: timestamp("analyzed_at"),
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

// ─── LOCATIONS ──────────────────────────────────────────────────

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

// ─── DECK PROPOSALS (Rogue Deck Builder) ────────────────────────

// Transient AI-generated deck drafts. Distinct from `decks` because they're
// not committed yet — they don't show up in deck_commitments / availability
// math until the user explicitly saves one (savedDeckId fills in then).
export const deckProposals = pgTable(
  "deck_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // 'standard' | 'rogue'
    commanderOracleId: uuid("commander_oracle_id"),
    partnerOracleId: uuid("partner_oracle_id"),
    targetBracket: integer("target_bracket"),
    archetypeBrief: text("archetype_brief"),
    status: text("status").notNull(), // 'generating' | 'ready' | 'failed' | 'saved'
    cardList: jsonb("card_list"),
    analysis: jsonb("analysis"),
    rogueRationale: jsonb("rogue_rationale"),
    critique: jsonb("critique"),
    generationLog: jsonb("generation_log"),
    model: text("model"),
    savedDeckId: uuid("saved_deck_id").references(() => decks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("deck_proposals_status_idx").on(t.status),
    createdAtIdx: index("deck_proposals_created_at_idx").on(t.createdAt),
  }),
);

// ─── TRANSACTIONS (Phase A: Trades & Market Intelligence) ──────

// Real-world event grouping inventory movements. A purchase has 1..N 'in'
// lines; a sale has 1..N 'out' lines; a trade has both. cashOutUsd /
// cashInUsd live on the header so trades with mixed cash legs ("trade plus
// $20") express naturally.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // 'purchase' | 'sale' | 'trade'
    occurredAt: timestamp("occurred_at").notNull(),
    counterparty: text("counterparty"),
    channel: text("channel"), // 'lgs' | 'online_marketplace' | 'private' | 'pack' | 'other'
    cashOutUsd: decimal("cash_out_usd", { precision: 10, scale: 2 }),
    cashInUsd: decimal("cash_in_usd", { precision: 10, scale: 2 }),
    feesUsd: decimal("fees_usd", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    kindIdx: index("transactions_kind_idx").on(t.kind),
    occurredAtIdx: index("transactions_occurred_at_idx").on(t.occurredAt),
    counterpartyIdx: index("transactions_counterparty_idx").on(t.counterparty),
  }),
);

// One line per inventory movement. allocated_value_usd = cost basis for
// 'in' lines / proceeds for 'out' lines (allocated from the header cash
// figures if multiple cards in one transaction). market_value_at_time_usd
// snapshots printing.usd so allocation works and retro fairness math has a
// stable basis even after prices move.
export const transactionLines = pgTable(
  "transaction_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    inventoryId: uuid("inventory_id").references(() => inventory.id, {
      onDelete: "set null",
    }),
    direction: text("direction").notNull(), // 'in' | 'out'
    printingId: uuid("printing_id")
      .notNull()
      .references(() => printings.id),
    allocatedValueUsd: decimal("allocated_value_usd", {
      precision: 10,
      scale: 2,
    }),
    marketValueAtTimeUsd: decimal("market_value_at_time_usd", {
      precision: 10,
      scale: 2,
    }),
  },
  (t) => ({
    transactionIdx: index("transaction_lines_transaction_id_idx").on(
      t.transactionId,
    ),
    inventoryIdx: index("transaction_lines_inventory_id_idx").on(t.inventoryId),
  }),
);

// ─── MARKET (Phase B: cached listings + want list) ──────────────

export const marketListings = pgTable(
  "market_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id").notNull(),
    sourceListingId: text("source_listing_id").notNull(),
    oracleId: uuid("oracle_id"),
    rawTitle: text("raw_title").notNull(),
    setCode: text("set_code"),
    condition: text("condition"),
    foil: boolean("foil"),
    priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
    shippingUsd: decimal("shipping_usd", { precision: 10, scale: 2 }),
    isSold: boolean("is_sold").default(false).notNull(),
    soldAt: timestamp("sold_at"),
    url: text("url").notNull(),
    confidence: decimal("confidence", { precision: 3, scale: 2 })
      .default("1.0")
      .notNull(),
    flags: text("flags").array(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => ({
    oracleIdx: index("market_listings_oracle_idx").on(t.oracleId),
    fetchedIdx: index("market_listings_fetched_idx").on(t.fetchedAt),
    soldIdx: index("market_listings_sold_idx").on(t.isSold, t.soldAt),
  }),
);

// Manual want list. Aggregated with deck-need shortfalls at query time —
// this table holds only entries the user added directly.
export const wants = pgTable(
  "wants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    oracleId: uuid("oracle_id").notNull(),
    targetQuantity: integer("target_quantity").default(1).notNull(),
    maxPriceUsd: decimal("max_price_usd", { precision: 10, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    oracleIdx: index("wants_oracle_idx").on(t.oracleId),
  }),
);

// ─── MARKET SOURCES (Phase C: scraper adapter configs) ──────────

// Per-source scraper config. Adapter PARSERS live in code (selected via
// parserTemplate); TARGETS live here so the user can wire up an LGS
// without touching the codebase. A hostile-marketplace denylist enforced
// in lib/market/sources/scraper/denylist.ts refuses to register adapters
// for TCGPlayer / Cardmarket / ebay.com.
export const marketSourcesTable = pgTable(
  "market_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull().unique(),
    displayName: text("display_name").notNull(),
    baseUrl: text("base_url").notNull(),
    parserTemplate: text("parser_template").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    robotsAcknowledged: boolean("robots_acknowledged")
      .default(false)
      .notNull(),
    termsNotes: text("terms_notes"),
    rateLimitPerMinute: integer("rate_limit_per_minute")
      .default(5)
      .notNull(),
    rateLimitPerDay: integer("rate_limit_per_day").default(200).notNull(),
    useWebUnlocker: boolean("use_web_unlocker").default(false).notNull(),
    lastRunAt: timestamp("last_run_at"),
    lastTestAt: timestamp("last_test_at"),
    lastTestOk: boolean("last_test_ok"),
    lastTestMessage: text("last_test_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index("market_sources_enabled_idx").on(t.enabled),
  }),
);
