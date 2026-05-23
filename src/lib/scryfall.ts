import { Readable } from "node:stream";
import StreamArray from "stream-json/streamers/StreamArray";
import { eq, getTableColumns, sql, type Table } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, printings, priceHistory, syncState } from "@/db/schema";
import {
  updateExtraTurnFlags,
  updateMldFlags,
  updateTutorFlags,
} from "@/lib/bracket-flags";

const SCRYFALL_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  Accept: "application/json",
};
const BULK_META = "https://api.scryfall.com/bulk-data";
const BATCH_SIZE = 500;
const LOG_INTERVAL = 10_000;
const SYNC_KEY = "scryfall_default_cards";

async function fetchScryfall(url: string): Promise<Response> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!res.ok) {
    throw new Error(`Scryfall ${res.status} ${res.statusText}: ${url}`);
  }
  return res;
}

// Build a SET clause for ON CONFLICT DO UPDATE that copies every column from
// the proposed-insert row (`excluded.<col>`) except the ones in `exclude`.
function excludedSet(table: Table, exclude: string[] = []) {
  const cols = getTableColumns(table);
  const set: Record<string, ReturnType<typeof sql.raw>> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (exclude.includes(key)) continue;
    set[key] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

async function getLastSyncedAt(key: string): Promise<Date | null> {
  const rows = await db
    .select()
    .from(syncState)
    .where(eq(syncState.key, key))
    .limit(1);
  const value = rows[0]?.value as { updatedAt?: string } | undefined;
  return value?.updatedAt ? new Date(value.updatedAt) : null;
}

async function setLastSyncedAt(key: string, when: Date) {
  await db
    .insert(syncState)
    .values({ key, value: { updatedAt: when.toISOString() } })
    .onConflictDoUpdate({
      target: syncState.key,
      set: {
        value: { updatedAt: when.toISOString() },
        updatedAt: sql`now()`,
      },
    });
}

type ScryfallPrices = {
  usd?: string | null;
  usd_foil?: string | null;
  usd_etched?: string | null;
  eur?: string | null;
  tix?: string | null;
};

type ScryfallCardFace = {
  oracle_text?: string;
};

export type ScryfallBulkRow = {
  id: string;
  oracle_id?: string;
  name: string;
  lang: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  layout?: string;
  card_faces?: ScryfallCardFace[];
  edhrec_rank?: number;
  reserved?: boolean;
  legalities?: Record<string, string>;
  set: string;
  set_name: string;
  collector_number: string;
  rarity?: string;
  image_uris?: Record<string, string>;
  released_at?: string;
  prices?: ScryfallPrices;
  finishes?: string[];
  promo_types?: string[];
  scryfall_uri?: string;
};

export type ScryfallRowTransform =
  | { skip: "non-english" }
  | { skip: "no-oracle-id" }
  | {
      skip: null;
      card: typeof cards.$inferInsert;
      printing: typeof printings.$inferInsert;
      price: typeof priceHistory.$inferInsert | null;
    };

/**
 * Pure transformation: one Scryfall bulk row → the database rows we want to
 * upsert. Extracted from the streaming loop so the row mapping (column
 * renames, type coercions, default fallbacks, legality boolean) is
 * unit-testable without spinning up a parser or DB.
 *
 * Skip reasons:
 * - non-english: we only persist English printings; localized faces would
 *   need a separate translation column the schema doesn't have.
 * - no-oracle-id: token cards and other Scryfall edge entries have no oracle
 *   identity; the printings table requires one.
 *
 * isExtraTurn / isMassLandDenial / isTutor / isGameChanger are deliberately
 * NOT set here — bracket-flags.ts runs canonical post-passes against the
 * fully-upserted data so there's one source of truth for those flags.
 */
export function transformScryfallRow(
  row: ScryfallBulkRow,
  today: string,
): ScryfallRowTransform {
  if (row.lang !== "en") return { skip: "non-english" };
  if (!row.oracle_id) return { skip: "no-oracle-id" };

  const card: typeof cards.$inferInsert = {
    oracleId: row.oracle_id,
    name: row.name,
    manaCost: row.mana_cost ?? null,
    cmc: row.cmc != null ? String(row.cmc) : null,
    typeLine: row.type_line ?? "",
    oracleText: row.oracle_text ?? null,
    power: row.power ?? null,
    toughness: row.toughness ?? null,
    loyalty: row.loyalty ?? null,
    colors: row.colors ?? null,
    colorIdentity: row.color_identity ?? null,
    keywords: row.keywords ?? null,
    layout: row.layout ?? null,
    cardFaces: row.card_faces ?? null,
    edhrecRank: row.edhrec_rank ?? null,
    isCommanderLegal: row.legalities?.commander === "legal",
    legalities: row.legalities ?? null,
    isReservedList: !!row.reserved,
  };

  const printing: typeof printings.$inferInsert = {
    id: row.id,
    oracleId: row.oracle_id,
    setCode: row.set,
    setName: row.set_name,
    collectorNumber: row.collector_number,
    rarity: row.rarity ?? null,
    imageUris: row.image_uris ?? null,
    cardFaces: row.card_faces ?? null,
    releasedAt: row.released_at ? new Date(row.released_at) : null,
    usd: row.prices?.usd ?? null,
    usdFoil: row.prices?.usd_foil ?? null,
    usdEtched: row.prices?.usd_etched ?? null,
    eur: row.prices?.eur ?? null,
    tix: row.prices?.tix ?? null,
    finishes: row.finishes ?? null,
    promoTypes: row.promo_types ?? null,
    scryfallUri: row.scryfall_uri ?? null,
  };

  // Only emit a price-history row when there's something to track —
  // many tokens, planar cards, etc. have no prices at all and we'd
  // otherwise insert a row of all-NULLs every sync.
  const price: typeof priceHistory.$inferInsert | null =
    row.prices && (row.prices.usd != null || row.prices.usd_foil != null)
      ? {
          printingId: row.id,
          date: today,
          usd: row.prices.usd ?? null,
          usdFoil: row.prices.usd_foil ?? null,
        }
      : null;

  return { skip: null, card, printing, price };
}

export async function syncScryfall(opts: { source: "local" | "cron" }) {
  console.log(`[scryfall] starting (source=${opts.source})`);

  const meta = (await fetchScryfall(BULK_META).then((r) => r.json())) as {
    data: Array<{ type: string; download_uri: string; updated_at: string }>;
  };
  const defaultCards = meta.data.find((d) => d.type === "default_cards");
  if (!defaultCards) throw new Error("No default_cards bulk file in metadata");

  const remoteUpdated = new Date(defaultCards.updated_at);
  const lastSynced = await getLastSyncedAt(SYNC_KEY);
  if (lastSynced && remoteUpdated.getTime() <= lastSynced.getTime()) {
    console.log(
      `[scryfall] already up to date (remote=${remoteUpdated.toISOString()})`,
    );
    return { skipped: true, remoteUpdated: remoteUpdated.toISOString() };
  }

  console.log(`[scryfall] downloading ${defaultCards.download_uri}`);
  const res = await fetchScryfall(defaultCards.download_uri);
  if (!res.body) throw new Error("Empty response body for bulk download");

  const today = new Date().toISOString().slice(0, 10);
  const nodeStream = Readable.fromWeb(
    res.body as unknown as Parameters<typeof Readable.fromWeb>[0],
  );
  const parser = nodeStream.pipe(StreamArray.withParser());

  let cardsBatch = new Map<string, typeof cards.$inferInsert>();
  let printingsBatch: (typeof printings.$inferInsert)[] = [];
  let priceBatch: (typeof priceHistory.$inferInsert)[] = [];
  let count = 0;
  let skipped = 0;

  async function flush() {
    if (cardsBatch.size > 0) {
      await db
        .insert(cards)
        .values([...cardsBatch.values()])
        .onConflictDoUpdate({
          target: cards.oracleId,
          set: { ...excludedSet(cards, ["oracleId"]), updatedAt: sql`now()` },
        });
      cardsBatch = new Map();
    }
    if (printingsBatch.length > 0) {
      await db
        .insert(printings)
        .values(printingsBatch)
        .onConflictDoUpdate({
          target: printings.id,
          set: { ...excludedSet(printings, ["id"]), updatedAt: sql`now()` },
        });
      printingsBatch = [];
    }
    if (priceBatch.length > 0) {
      await db
        .insert(priceHistory)
        .values(priceBatch)
        .onConflictDoUpdate({
          target: [priceHistory.printingId, priceHistory.date],
          set: excludedSet(priceHistory, ["printingId", "date"]),
        });
      priceBatch = [];
    }
  }

  for await (const chunk of parser) {
    const c = chunk.value as ScryfallBulkRow;
    const result = transformScryfallRow(c, today);
    if (result.skip != null) {
      skipped++;
      continue;
    }
    cardsBatch.set(result.card.oracleId, result.card);
    printingsBatch.push(result.printing);
    if (result.price) priceBatch.push(result.price);

    count++;
    if (cardsBatch.size >= BATCH_SIZE || printingsBatch.length >= BATCH_SIZE) {
      await flush();
    }
    if (count % LOG_INTERVAL === 0) {
      console.log(`[scryfall] processed ${count} cards`);
    }
  }

  await flush();

  // Run the canonical bracket-flag passes against the freshly upserted data.
  await updateExtraTurnFlags();
  await updateMldFlags();

  await setLastSyncedAt(SYNC_KEY, remoteUpdated);

  console.log(
    `[scryfall] done — processed=${count} skipped=${skipped} remoteUpdated=${remoteUpdated.toISOString()}`,
  );
  return {
    count,
    skipped,
    remoteUpdated: remoteUpdated.toISOString(),
  };
}

// Thin wrapper kept for the standalone seed script. Canonical logic lives in
// bracket-flags.ts so /api/cron/refresh-bracket-flags can share it.
export async function syncTutors() {
  const count = await updateTutorFlags();
  return { count };
}
