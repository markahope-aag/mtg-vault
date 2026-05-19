# MTG Vault — v0 Build Spec

A personal Magic: The Gathering inventory and Commander deckbuilding tool. Desktop-first web app. Single user (you). Built on Next.js + Supabase + Drizzle, deployed to Vercel.

> **Working project name:** `mtg-vault`. Rename anything you want once you ship.

---

## 1. Goals (v0 scope)

1. **Inventory.** Know what cards you own, where they are, what you paid, what they're worth now.
2. **Deckbuilder.** Build and edit Commander decks against your inventory. "Own / need" diff per deck.
3. **Bracket engine.** Compute the official Commander Bracket (1–5) for any deck, with a "to drop a bracket, remove these cards" diff.
4. **Value.** Total collection value, per-deck value, value-over-time charts.

**Explicitly out of v0:** camera scanning, AI strategy advisor, PWA, multi-user, non-Commander formats. All deferred to v1+.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui | DataTable, Command palette, Dialog, Form |
| DB | Supabase Postgres | Hosted, free tier is fine for personal use |
| ORM | Drizzle | Matches your usual setup |
| Auth | Supabase Auth (magic link) | Email allowlist of just you |
| Tables | TanStack Table v8 | For inventory grid |
| Client state | TanStack Query | For Scryfall queries, deck mutations |
| Forms | react-hook-form + Zod | Standard |
| Cron | Vercel Cron | Daily Scryfall + Spellbook + Game Changers sync |
| Deploy | Vercel | Free tier; Postgres on Supabase |
| Icons | Lucide | |

**Why Supabase over PlanetScale here:** Postgres has better JSON support, which matters for the Scryfall data shape (Scryfall returns deeply nested JSON for prices, image_uris, card_faces).

---

## 3. Setup (Windows PowerShell)

```powershell
# Prerequisites: Node 20+, pnpm, git, claude (Claude Code CLI)
# Verify:
node --version
pnpm --version
claude --version

# Bootstrap
mkdir mtg-vault
cd mtg-vault
pnpm create next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack

# Core dependencies
pnpm add drizzle-orm postgres @supabase/supabase-js @supabase/ssr
pnpm add @tanstack/react-table @tanstack/react-query
pnpm add react-hook-form @hookform/resolvers zod
pnpm add lucide-react date-fns recharts
pnpm add papaparse  # CSV parsing
pnpm add -D drizzle-kit @types/papaparse tsx

# shadcn/ui
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button input label form dialog table command popover select badge card tabs separator dropdown-menu sonner

# Env file (do NOT commit)
New-Item -ItemType File -Path .env.local
# Add the following keys (fill in values from Supabase dashboard):
#   NEXT_PUBLIC_SUPABASE_URL=
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=
#   SUPABASE_SERVICE_ROLE_KEY=     (server-only, for sync jobs)
#   DATABASE_URL=                  (Supabase direct connection string)
#   CRON_SECRET=                   (random string for cron auth)
#   ALLOWED_EMAIL=                 (your email)

# Start Claude Code in this directory
claude
```

**PowerShell gotchas to know:**
- `&&` works in PS 7+ only. On PS 5.1, use `;` to chain commands (or just run them separately).
- Set session env vars with `$env:VARNAME = "value"`. For persistent, edit `.env.local`.
- Paths: forward slashes work in all Node tools; you can mix.

---

## 4. Project structure

```
mtg-vault/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx              # Auth-gated shell
│   │   │   ├── inventory/page.tsx      # Data table view
│   │   │   ├── decks/
│   │   │   │   ├── page.tsx            # Deck list
│   │   │   │   └── [id]/page.tsx       # Three-pane builder
│   │   │   ├── cards/[oracle_id]/page.tsx  # Card detail
│   │   │   └── dashboard/page.tsx      # Value charts
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   ├── scryfall-sync/route.ts
│   │   │   │   ├── game-changers-sync/route.ts
│   │   │   │   └── spellbook-sync/route.ts
│   │   │   ├── search/route.ts         # Card search (Scryfall fallback + local)
│   │   │   ├── import/csv/route.ts     # CSV importer
│   │   │   └── bracket/route.ts        # Bracket calculation
│   ├── components/
│   │   ├── card-search/                # cmd-K palette
│   │   ├── deckbuilder/                # Three-pane layout
│   │   ├── inventory-table/            # TanStack Table wrapper
│   │   └── ui/                         # shadcn primitives
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema (see §5)
│   │   ├── client.ts                   # Drizzle client
│   │   └── queries/                    # Reusable query functions
│   ├── lib/
│   │   ├── scryfall.ts                 # Scryfall client + sync
│   │   ├── spellbook.ts                # Commander Spellbook client
│   │   ├── bracket-engine.ts           # Bracket calculation
│   │   ├── importers/
│   │   │   ├── manabox.ts
│   │   │   ├── moxfield.ts
│   │   │   ├── archidekt.ts
│   │   │   └── detect.ts               # Header sniffing
│   │   └── supabase/
│   │       ├── server.ts
│   │       └── client.ts
│   └── middleware.ts                   # Email allowlist enforcement
├── drizzle/                            # Generated migrations
├── drizzle.config.ts
├── vercel.json                         # Cron config
└── .env.local
```

---

## 5. Database schema (Drizzle)

Two layers: **reference** (synced from external sources, never user-edited) and **user** (your inventory and decks).

```typescript
// src/db/schema.ts
import { pgTable, text, integer, boolean, timestamp, jsonb, uuid, decimal, primaryKey, index } from "drizzle-orm/pg-core";

// ─── REFERENCE LAYER (synced nightly from Scryfall) ─────────────

export const cards = pgTable("cards", {
  oracleId: uuid("oracle_id").primaryKey(),
  name: text("name").notNull(),
  manaCost: text("mana_cost"),
  cmc: decimal("cmc", { precision: 4, scale: 1 }),
  typeLine: text("type_line").notNull(),
  oracleText: text("oracle_text"),
  power: text("power"),
  toughness: text("toughness"),
  loyalty: text("loyalty"),
  colors: text("colors").array(),              // ['W','U']
  colorIdentity: text("color_identity").array(),
  keywords: text("keywords").array(),
  layout: text("layout"),                       // normal, transform, modal_dfc, etc.
  cardFaces: jsonb("card_faces"),               // For DFCs/split cards
  edhrecRank: integer("edhrec_rank"),
  isCommanderLegal: boolean("is_commander_legal").default(true),
  isReservedList: boolean("is_reserved_list").default(false),
  // Bracket-relevant flags (set during sync from Scryfall tags / our own rules):
  isGameChanger: boolean("is_game_changer").default(false),
  isExtraTurn: boolean("is_extra_turn").default(false),
  isMassLandDenial: boolean("is_mass_land_denial").default(false),
  isTutor: boolean("is_tutor").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  nameIdx: index("cards_name_idx").on(t.name),
  edhrecRankIdx: index("cards_edhrec_rank_idx").on(t.edhrecRank),
}));

export const printings = pgTable("printings", {
  id: uuid("id").primaryKey(),                  // Scryfall card id
  oracleId: uuid("oracle_id").notNull().references(() => cards.oracleId, { onDelete: "cascade" }),
  setCode: text("set_code").notNull(),
  setName: text("set_name").notNull(),
  collectorNumber: text("collector_number").notNull(),
  rarity: text("rarity"),                       // common, uncommon, rare, mythic
  imageUris: jsonb("image_uris"),               // { small, normal, large, png, art_crop, border_crop }
  releasedAt: timestamp("released_at"),
  usd: decimal("usd", { precision: 10, scale: 2 }),
  usdFoil: decimal("usd_foil", { precision: 10, scale: 2 }),
  usdEtched: decimal("usd_etched", { precision: 10, scale: 2 }),
  eur: decimal("eur", { precision: 10, scale: 2 }),
  tix: decimal("tix", { precision: 10, scale: 2 }),
  finishes: text("finishes").array(),           // ['nonfoil','foil','etched']
  promoTypes: text("promo_types").array(),
  scryfallUri: text("scryfall_uri"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  oracleIdx: index("printings_oracle_id_idx").on(t.oracleId),
  setIdx: index("printings_set_code_idx").on(t.setCode),
}));

export const priceHistory = pgTable("price_history", {
  printingId: uuid("printing_id").notNull().references(() => printings.id, { onDelete: "cascade" }),
  date: text("date").notNull(),                 // YYYY-MM-DD
  usd: decimal("usd", { precision: 10, scale: 2 }),
  usdFoil: decimal("usd_foil", { precision: 10, scale: 2 }),
}, (t) => ({
  pk: primaryKey({ columns: [t.printingId, t.date] }),
  dateIdx: index("price_history_date_idx").on(t.date),
}));

export const combos = pgTable("combos", {
  id: text("id").primaryKey(),                  // Commander Spellbook combo id
  name: text("name"),
  resultText: text("result_text"),              // What the combo does
  pieceCount: integer("piece_count").notNull(), // Number of cards required
  colorIdentity: text("color_identity").array(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  pieceCountIdx: index("combos_piece_count_idx").on(t.pieceCount),
}));

export const comboPieces = pgTable("combo_pieces", {
  comboId: text("combo_id").notNull().references(() => combos.id, { onDelete: "cascade" }),
  oracleId: uuid("oracle_id").notNull().references(() => cards.oracleId, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.comboId, t.oracleId] }),
  oracleIdx: index("combo_pieces_oracle_id_idx").on(t.oracleId),
}));

// ─── USER LAYER ─────────────────────────────────────────────────

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  printingId: uuid("printing_id").notNull().references(() => printings.id),
  quantity: integer("quantity").notNull().default(1),
  foil: boolean("foil").default(false),
  etched: boolean("etched").default(false),
  condition: text("condition").default("NM"),   // NM, LP, MP, HP, DMG
  language: text("language").default("en"),
  location: text("location"),                   // "Long box 1", "Atraxa deck", "Trade binder"
  acquiredPrice: decimal("acquired_price", { precision: 10, scale: 2 }),
  acquiredAt: timestamp("acquired_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  printingIdx: index("inventory_printing_id_idx").on(t.printingId),
}));

export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  commanderPrintingId: uuid("commander_printing_id").references(() => printings.id),
  partnerPrintingId: uuid("partner_printing_id").references(() => printings.id),
  targetBracket: integer("target_bracket"),     // 1-5, what you're aiming for
  archetype: text("archetype"),                 // "Aristocrats", "Voltron", etc.
  notes: text("notes"),
  isPrimary: boolean("is_primary").default(false), // Sleeved up / built physically
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deckCards = pgTable("deck_cards", {
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  printingId: uuid("printing_id").notNull().references(() => printings.id),
  quantity: integer("quantity").notNull().default(1),
  category: text("category").default("main"),   // main, maybeboard, considering
  isCommander: boolean("is_commander").default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.deckId, t.printingId, t.category] }),
}));

export const deckSnapshots = pgTable("deck_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  totalValueUsd: decimal("total_value_usd", { precision: 12, scale: 2 }),
  calculatedBracket: integer("calculated_bracket"),
  bracketReasons: jsonb("bracket_reasons"),     // { gameChangers: [...], combos: [...], etc. }
}, (t) => ({
  deckIdx: index("deck_snapshots_deck_id_idx").on(t.deckId),
}));
```

Generate migrations:

```powershell
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 6. Data sync jobs

All three run nightly via Vercel Cron. Each is a `GET /api/cron/...` route protected by `CRON_SECRET` (passed in `Authorization: Bearer ${CRON_SECRET}`). Vercel injects the secret in production; in dev, hit the endpoint manually.

### 6.1 Scryfall sync (`/api/cron/scryfall-sync`)

Scryfall's [bulk data endpoint](https://api.scryfall.com/bulk-data) returns metadata for downloadable JSON files. Use the **"Default Cards"** file (~500MB, every English-language printing with full data). Stream parse it — never `JSON.parse` the whole file into memory on Vercel.

```typescript
// src/lib/scryfall.ts
import { db } from "@/db/client";
import { cards, printings, priceHistory } from "@/db/schema";
import { sql } from "drizzle-orm";

const BULK_META = "https://api.scryfall.com/bulk-data";

export async function syncScryfall() {
  // 1. Get the download URI for "default_cards"
  const meta = await fetch(BULK_META).then(r => r.json());
  const defaultCards = meta.data.find((d: any) => d.type === "default_cards");
  if (!defaultCards) throw new Error("No default_cards bulk file");

  // 2. Stream-parse the JSON (use a streaming JSON parser like `stream-json`)
  //    or pipe to a temp file and read in chunks
  const res = await fetch(defaultCards.download_uri);
  if (!res.ok || !res.body) throw new Error("Bulk download failed");

  // 3. For each card object, upsert into cards (dedupe by oracle_id) and printings
  //    Batch upserts in chunks of 500
  //    Capture today's price into price_history (one row per printing per day)

  // Pseudocode for the per-card transformation:
  //   const card = { oracleId, name, manaCost, cmc, typeLine, oracleText, colors,
  //                  colorIdentity, keywords, layout, cardFaces, edhrecRank,
  //                  isCommanderLegal: !legalities.commander === 'not_legal',
  //                  isReservedList: reserved };
  //   const printing = { id, oracleId, setCode, setName, collectorNumber,
  //                      rarity, imageUris, releasedAt, usd, usdFoil, usdEtched,
  //                      eur, tix, finishes, promoTypes, scryfallUri };

  // 4. After upsert, run a second pass to set bracket-relevant flags:
  //    - isExtraTurn: oracle_text ILIKE '%extra turn%' AND type_line NOT ILIKE '%land%'
  //    - isMassLandDenial: see curated list below
  //    - isTutor: see Scryfall `is:tutor` query, or use curated list
  //    Game changers are handled by the separate game-changers sync.
}
```

**Recommended npm package:** `stream-json` for streaming parse. Don't try to load 500MB into a string.

**MLD curated list** (seed these with `isMassLandDenial = true` after sync):
Armageddon, Catastrophe, Ravages of War, Wildfire, Decree of Annihilation, Obliterate, Jokulhaups, Cataclysm, Cleansing, Worldfire, Magus of the Disk (when paired with land-destruction shells), Sunder, Land Equilibrium, Global Ruin, Akroma's Vengeance. Keep this list in `/src/lib/curated/mld.ts` so you can extend it.

**Tutor list:** Scryfall maintains a tag — query `is:tutor` returns ~200 cards. Fetch this list during sync and flip `isTutor = true`. URL: `https://api.scryfall.com/cards/search?q=is%3Atutor&unique=cards`.

### 6.2 Game Changers sync (`/api/cron/game-changers-sync`)

Scryfall maintains the official Game Changers list under the `game_changer:true` flag. Pull it directly:

```typescript
// src/lib/game-changers.ts
export async function syncGameChangers() {
  const url = "https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards";
  let next: string | null = url;
  const oracleIds = new Set<string>();

  while (next) {
    const data = await fetch(next).then(r => r.json());
    for (const card of data.data) oracleIds.add(card.oracle_id);
    next = data.has_more ? data.next_page : null;
    await new Promise(r => setTimeout(r, 100)); // Scryfall asks for 50–100ms between requests
  }

  // Reset flag, then mark current set
  await db.update(cards).set({ isGameChanger: false }).execute();
  await db.update(cards)
    .set({ isGameChanger: true })
    .where(sql`oracle_id = ANY(${Array.from(oracleIds)}::uuid[])`)
    .execute();
}
```

**Scryfall request etiquette:** they ask for a 50–100ms delay between requests, a meaningful `User-Agent`, and an `Accept: application/json` header. Add both.

### 6.3 Commander Spellbook sync (`/api/cron/spellbook-sync`)

Commander Spellbook publishes their full database as JSON at `https://json.commanderspellbook.com/variants.json` (~50MB). Fetch, parse, upsert `combos` and `combo_pieces`.

```typescript
export async function syncSpellbook() {
  const data = await fetch("https://json.commanderspellbook.com/variants.json").then(r => r.json());
  // Each variant has: id, name, status, uses (array of { card: { oracleId } }), produces (array of features)
  // Insert into combos (one row), then combo_pieces (one per used card)
  // Filter to status === 'OK' (excludes broken / illegal / draft combos)
  // pieceCount = variant.uses.length
}
```

### 6.4 Cron config (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/scryfall-sync", "schedule": "0 6 * * *" },
    { "path": "/api/cron/game-changers-sync", "schedule": "30 6 * * *" },
    { "path": "/api/cron/spellbook-sync", "schedule": "0 7 * * *" }
  ]
}
```

---

## 7. CSV importer

Three vendor formats to support: **ManaBox**, **Moxfield**, **Archidekt**. Detect by header signature, route to the right parser, normalize to a common shape, then upsert into `inventory`.

```typescript
// src/lib/importers/detect.ts
type ImporterFormat = "manabox" | "moxfield" | "archidekt" | "tcgplayer" | "unknown";

export function detectFormat(headers: string[]): ImporterFormat {
  const h = new Set(headers.map(s => s.toLowerCase()));
  if (h.has("scryfall id") && h.has("foil")) return "manabox";
  if (h.has("tradelist count") && h.has("edition")) return "moxfield";
  if (h.has("collectornumber") && h.has("edition code")) return "archidekt";
  if (h.has("product name") && h.has("number")) return "tcgplayer";
  return "unknown";
}
```

**Common shape** (normalize all three to this):

```typescript
type NormalizedRow = {
  name: string;
  setCode: string;            // lowercase 3-5 letter Scryfall set code
  collectorNumber: string;
  quantity: number;
  foil: boolean;
  condition?: "NM" | "LP" | "MP" | "HP" | "DMG";
  language?: string;
  acquiredPrice?: number;
};
```

**Matching strategy** for each row:
1. Best case: row has `scryfall_id` (ManaBox does) → direct lookup in `printings`.
2. Otherwise: `setCode + collectorNumber` → unique key in `printings`. Lookup.
3. Fallback: `name + setCode` → may match multiple printings (variant collector numbers); flag for manual disambiguation.
4. Last resort: name only → present a chooser if multiple matches.

Build the UI as: upload → preview table → resolve unmatched rows → confirm → batch insert.

---

## 8. Deckbuilder UI

**Three-pane layout** at ≥1280px, single column below (graceful degradation, not the priority):

```
┌──────────────────────────────────────────────────────────────────┐
│  Atraxa, Praetors' Voice — Target: Bracket 3 — Current: B4 ⚠     │  Header
├──────────────┬──────────────────────────────┬────────────────────┤
│              │                              │                    │
│  Search      │   Decklist (99 + 1)          │  Card detail       │
│  + Filters   │   grouped by type            │  + EDHREC rank     │
│              │                              │  + Synergy with    │
│  Inventory   │   Creatures (28)             │    commander       │
│  toggle:     │     1 Atraxa, Praetors' Voi… │  + Combos this     │
│  [ ] only    │     1 Solemn Simulacrum      │    card is in      │
│  cards I own │     ...                      │  + Owned: 2 (1F)   │
│              │   Lands (37)                 │                    │
│              │   ...                        │                    │
│              │                              │                    │
└──────────────┴──────────────────────────────┴────────────────────┘
```

**Keyboard-first interactions (table stakes for a desktop tool):**

| Shortcut | Action |
|---|---|
| `cmd/ctrl + k` | Open global card search palette |
| `↑ ↓` | Navigate results |
| `Enter` | Add highlighted card to active deck |
| `1`–`9` | Set quantity for newly added card (default 1) |
| `cmd/ctrl + Enter` | Add to maybeboard instead of main |
| `Backspace` on a decklist row | Remove |
| `cmd/ctrl + /` | Toggle "owned cards only" filter |
| `cmd/ctrl + b` | Recalculate bracket |
| `cmd/ctrl + s` | Save snapshot |

Use the shadcn `Command` component (CMDK under the hood) for the palette. Wire keyboard handlers at the page level with `useEffect`.

**Decklist grouping:** Creatures → Planeswalkers → Instants → Sorceries → Artifacts → Enchantments → Battles → Lands. Auto-sort by CMC then alpha within each group.

**Owned/needed indicator on every row:** small badge showing `Own: 1/1` or `Need: 0/1`. Drives the "what do I actually need to buy to complete this deck" calculation.

---

## 9. Bracket engine

This is the unique value of the tool. Build it as a pure function that takes a decklist and returns a structured result.

```typescript
// src/lib/bracket-engine.ts

type DeckCard = { oracleId: string; quantity: number; isCommander: boolean };

type BracketResult = {
  bracket: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
  gameChangers: Array<{ oracleId: string; name: string }>;
  twoCardCombos: Array<{ comboId: string; pieces: string[]; resultText: string }>;
  massLandDenial: Array<{ oracleId: string; name: string }>;
  extraTurnCards: Array<{ oracleId: string; name: string }>;
  tutorCount: number;
  // What you'd need to remove to drop a bracket
  toReachBracket: {
    [target: number]: { remove: Array<{ oracleId: string; name: string; reason: string }> };
  };
};

export async function calculateBracket(deck: DeckCard[]): Promise<BracketResult> {
  const oracleIds = deck.map(d => d.oracleId);

  // Fetch flags for all deck cards in one query
  const flaggedCards = await db
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      isGameChanger: cards.isGameChanger,
      isMassLandDenial: cards.isMassLandDenial,
      isExtraTurn: cards.isExtraTurn,
      isTutor: cards.isTutor,
    })
    .from(cards)
    .where(sql`oracle_id = ANY(${oracleIds}::uuid[])`);

  const gameChangers = flaggedCards.filter(c => c.isGameChanger);
  const mld = flaggedCards.filter(c => c.isMassLandDenial);
  const extraTurns = flaggedCards.filter(c => c.isExtraTurn);
  const tutorCount = flaggedCards.filter(c => c.isTutor).length;

  // Find two-card combos entirely contained in the deck
  // A combo is "in the deck" if ALL its pieces are in the deck.
  // Query: combos where pieceCount = 2 AND every piece's oracle_id is in our deck
  const twoCardCombos = await db.execute(sql`
    SELECT c.id, c.name, c.result_text, array_agg(cp.oracle_id) AS pieces
    FROM combos c
    JOIN combo_pieces cp ON cp.combo_id = c.id
    WHERE c.piece_count = 2
    GROUP BY c.id, c.name, c.result_text
    HAVING bool_and(cp.oracle_id = ANY(${oracleIds}::uuid[]))
  `);

  // Bracket determination per WotC's published rules
  // (see https://magic.wizards.com/en/news/announcements for the current criteria;
  //  sync this logic against the latest beta update at build time)
  const reasons: string[] = [];
  let bracket: 1 | 2 | 3 | 4 | 5 = 2;

  // Bracket 5 (cEDH) is intent-based and can't be auto-detected reliably.
  // We can flag "cEDH-shaped" if all of: many game changers, fast mana density, low CMC,
  // heavy tutoring, 2-card infinite present. Surface as "Looks like cEDH" but let user confirm.
  const looksLikeCEDH =
    gameChangers.length >= 5 &&
    twoCardCombos.length >= 1 &&
    tutorCount >= 5;

  if (looksLikeCEDH) {
    bracket = 5;
    reasons.push(`High Game Changer count (${gameChangers.length}), 2-card infinite present, ${tutorCount} tutors`);
  } else if (gameChangers.length > 3 || twoCardCombos.length > 0) {
    bracket = 4;
    if (gameChangers.length > 3) reasons.push(`${gameChangers.length} Game Changers (Bracket 3 allows 3)`);
    if (twoCardCombos.length > 0) reasons.push(`${twoCardCombos.length} two-card infinite combo(s) detected`);
  } else if (
    gameChangers.length >= 1 ||
    extraTurns.length >= 3 ||
    mld.length > 0
  ) {
    bracket = 3;
    if (gameChangers.length) reasons.push(`${gameChangers.length} Game Changer(s) — none allowed in Bracket 2`);
    if (extraTurns.length >= 3) reasons.push(`${extraTurns.length} extra-turn cards (chaining risk)`);
    if (mld.length) reasons.push(`${mld.length} mass land denial card(s) — not appropriate for Bracket 2`);
  } else {
    bracket = 2;
  }

  // Build "to drop a bracket" diffs
  const toReachBracket: BracketResult["toReachBracket"] = {};
  if (bracket >= 3) {
    toReachBracket[2] = {
      remove: [
        ...gameChangers.map(c => ({ oracleId: c.oracleId, name: c.name, reason: "Game Changer (not allowed B1/B2)" })),
        ...mld.map(c => ({ oracleId: c.oracleId, name: c.name, reason: "Mass land denial" })),
        ...(extraTurns.length >= 3 ? extraTurns.slice(0, extraTurns.length - 2).map(c => ({ oracleId: c.oracleId, name: c.name, reason: "Extra turn (reduce to ≤2)" })) : []),
      ],
    };
  }
  if (bracket >= 4) {
    toReachBracket[3] = {
      remove: [
        ...(gameChangers.length > 3 ? gameChangers.slice(3).map(c => ({ oracleId: c.oracleId, name: c.name, reason: "Game Changer count over 3" })) : []),
        ...twoCardCombos.flatMap(combo => combo.pieces.slice(0, 1).map((id: string) => ({ oracleId: id, name: "", reason: `Breaks 2-card combo: ${combo.name}` }))),
      ],
    };
  }

  return {
    bracket,
    reasons,
    gameChangers: gameChangers.map(c => ({ oracleId: c.oracleId, name: c.name })),
    twoCardCombos: twoCardCombos as any,
    massLandDenial: mld.map(c => ({ oracleId: c.oracleId, name: c.name })),
    extraTurnCards: extraTurns.map(c => ({ oracleId: c.oracleId, name: c.name })),
    tutorCount,
    toReachBracket,
  };
}
```

**Important caveat to surface in UI:** Bracket 5 is intent-based — WotC explicitly says cEDH is about tournament play, not just power level. The engine can detect "this deck is cEDH-shaped" but should never auto-classify as B5 without user confirmation. Show as: "Looks like Bracket 4/5 — is this built for tournaments? [Yes, it's cEDH] [No, just powerful]".

---

## 10. Value tracking

Three views:

1. **Collection total** — `SELECT SUM(printings.usd * inventory.quantity) FROM inventory JOIN printings ON ...`. Show foil pricing where `inventory.foil = true`.
2. **Per-deck value** — same join, scoped by `deck_cards`.
3. **Value over time** — chart from `deck_snapshots.totalValueUsd` + `priceHistory` aggregated across owned printings.

Use Recharts (`AreaChart` for collection value, `LineChart` for per-deck snapshot timeline).

**Snapshot trigger:** on every deck save, write a row to `deck_snapshots` with computed bracket and value. Cheap, gives you a full history.

---

## 11. Auth (single-user)

Supabase magic-link with an email allowlist enforced in middleware:

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* ... see Supabase SSR docs */ } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");
  const isApiCron = req.nextUrl.pathname.startsWith("/api/cron");

  if (isApiCron) return res; // cron uses CRON_SECRET, not user auth

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (user && user.email !== process.env.ALLOWED_EMAIL) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", req.url));
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

Single-user trick: no `user_id` columns needed on inventory/decks. You're the only writer. If you ever go multi-user later, add a `userId` column and backfill.

---

## 12. Phased build order

Each phase is a discrete Claude Code session. Don't try to do them all in one shot.

| Phase | Effort | Output |
|---|---|---|
| **P1: Foundation** | 3–4h | Project scaffolded, Drizzle wired to Supabase, schema migrated, auth + middleware working, can log in |
| **P2: Scryfall sync** | 5–7h | `/api/cron/scryfall-sync` populates `cards` + `printings`. Manual trigger works. ~120K printings in DB. |
| **P3: Card search** | 4–5h | `cmd-K` global palette, server-side fuzzy search over local `cards` table, card detail page renders |
| **P4: Inventory** | 6–8h | Manual add/edit, TanStack Table grid with filters, total value display |
| **P5: CSV importer** | 6–8h | Upload UI, header detection, ManaBox + Moxfield + Archidekt parsers, unmatched-row resolver |
| **P6: Decks (CRUD)** | 3–4h | Deck list, create/rename/delete, commander assignment |
| **P7: Deckbuilder UI** | 8–10h | Three-pane layout, keyboard shortcuts, owned/needed badges, decklist grouping |
| **P8: Game Changers + Spellbook sync** | 3–4h | Both cron jobs working, flags populated |
| **P9: Bracket engine** | 5–7h | Pure function + API route, UI panel showing current bracket + diff to lower brackets |
| **P10: Value over time** | 3–4h | Snapshot writer on deck save, Recharts dashboards |

**Total: ~46–61h.** Not 30–45 like I quoted earlier — I underestimated the importer and deckbuilder. Real numbers.

---

## 13. Claude Code kickoff prompt

Paste this verbatim into your first Claude Code session in the `mtg-vault` directory (after running the setup commands in §3):

> ```
> You're helping me build MTG Vault, a personal Magic: The Gathering inventory and Commander deckbuilding tool. The full spec is in ./mtg-vault-v0-spec.md — read it first, end to end, before doing anything else.
>
> We're building in phases. Right now we're on Phase 1: Foundation. Do not touch later phases.
>
> Phase 1 deliverables:
> 1. Verify the Next.js + Tailwind + shadcn scaffold is in place (it should be — I ran the bootstrap commands already).
> 2. Set up Drizzle: create src/db/client.ts pointing at DATABASE_URL, create drizzle.config.ts, write the schema in src/db/schema.ts exactly as specified in §5 of the spec.
> 3. Generate and apply the initial migration. Confirm tables exist in Supabase.
> 4. Wire up Supabase Auth: create src/lib/supabase/server.ts and src/lib/supabase/client.ts following the @supabase/ssr cookie pattern. Add the login page at src/app/(auth)/login/page.tsx with magic-link form. Add the middleware in src/middleware.ts exactly as specified in §11.
> 5. Create a stub /app/(app)/layout.tsx that just renders children inside a basic header showing the logged-in email and a "Log out" button.
> 6. Add a stub /app/(app)/dashboard/page.tsx that says "MTG Vault — Phase 1 complete".
> 7. Verify the auth flow end-to-end: I should be able to hit /, get redirected to /login, request a magic link, click it from my email, and land on /dashboard.
>
> Ask me before installing any package not already listed in package.json. Use pnpm, not npm. When you write SQL or Drizzle queries, run them through `pnpm drizzle-kit` rather than crafting raw migrations. We're on Windows PowerShell — use && only if you've confirmed pnpm is being run in PS 7+, otherwise chain commands with `;` or run them sequentially.
>
> When Phase 1 is done, stop and wait for me to verify before starting Phase 2. Do not assume Phase 2 starts automatically.
> ```

For subsequent phases, the prompt template is the same — change the phase number and deliverables list, point at the relevant spec section, and keep the "stop and wait" discipline. That last instruction is what keeps Claude Code from cargo-culting ahead of you into work you haven't reviewed yet.

---

## 14. Things I deliberately left out

- **Card image hosting.** Use Scryfall's `image_uris` directly — they're CDN-backed and serving images is their explicit policy. Don't proxy or self-host.
- **Multi-currency.** USD only in v0. If you want EUR later, you've already got the column.
- **Sealed product / packs / boxes tracking.** Personal tool, you can just put "1x Bloomburrow Commander Precon" in `notes` if you want.
- **Trade tracking.** Out of scope. The acquisition price column gives you cost basis if you ever need it.
- **Format legality beyond Commander.** `isCommanderLegal` is the only legality flag in v0.
- **Tagging / categorization beyond `location`.** You can add a tags array later. Don't pre-build.
- **Mobile.** Already covered. Add PWA in v1.5 if you ever miss it.

---

## 15. What v1+ adds (for reference, not v0 scope)

- PWA shell (manifest, service worker, offline inventory read) — 4–6h
- Single-card Claude vision scanner — 6–8h
- LLM strategy advisor (decklist → archetype, win cons, gameplan, weaknesses, "cards in your inventory that would improve this deck") — 12–16h
- EDHREC-style synergy view ("commonly played with [commander]") via EDHREC unofficial API — 4–6h
- Non-Commander format legality checking — 2–3h per format
- Trade tracker — 6–8h

Total v1 if you do all of it: ~35–50h.
