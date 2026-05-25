import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { toIso } from "@/lib/utils";
import type { InventoryRowWithCard } from "@/lib/inventory/types";

export type UsedInDeck = {
  deckId: string;
  deckName: string;
  commanderName: string | null;
  category: string;
  quantity: number;
};

export type SynergyRow = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  imageUri: string | null;
  coDecks: number;
  edhrecRank: number | null;
  ownedCount: number;
};

export async function fetchDecksUsing(
  oracleId: string,
): Promise<UsedInDeck[]> {
  const rows = (await db.execute(sql`
    SELECT d.id AS deck_id, d.name AS deck_name,
           cmd.name AS commander_name,
           dc.category, dc.quantity
    FROM deck_cards dc
    JOIN printings p ON p.id = dc.printing_id
    JOIN decks d ON d.id = dc.deck_id
    LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
    LEFT JOIN cards cmd ON cmd.oracle_id = cmd_p.oracle_id
    WHERE p.oracle_id = ${oracleId}
    ORDER BY d.name ASC
  `)) as unknown as Array<{
    deck_id: string;
    deck_name: string;
    commander_name: string | null;
    category: string;
    quantity: number;
  }>;
  return rows.map((r) => ({
    deckId: r.deck_id,
    deckName: r.deck_name,
    commanderName: r.commander_name,
    category: r.category,
    quantity: r.quantity,
  }));
}

// Find cards that co-occur with this card across the user's own decks.
// "Synergy" here is operationalized as deck co-occurrence: if you've put
// card X in the same deck as this card N times, X is N-synergy. Personal
// data is the strongest synergy signal we have without scraping EDHrec.
export async function fetchSynergies(
  oracleId: string,
): Promise<SynergyRow[]> {
  const rows = (await db.execute(sql`
    WITH host_decks AS (
      SELECT DISTINCT dc.deck_id
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      WHERE p.oracle_id = ${oracleId}
    )
    SELECT
      c.oracle_id, c.name, c.mana_cost, c.type_line, c.edhrec_rank,
      COUNT(DISTINCT dc.deck_id)::int AS co_decks,
      (
        SELECT COUNT(*)::int FROM inventory i
        JOIN printings ip ON ip.id = i.printing_id
        WHERE ip.oracle_id = c.oracle_id AND i.disposed_at IS NULL
      ) AS owned_count,
      (
        SELECT COALESCE(
          p2.image_uris ->> 'small',
          p2.card_faces -> 0 -> 'image_uris' ->> 'small',
          c.card_faces -> 0 -> 'image_uris' ->> 'small'
        )
        FROM printings p2
        WHERE p2.oracle_id = c.oracle_id
        ORDER BY p2.released_at DESC NULLS LAST, p2.set_code
        LIMIT 1
      ) AS image_uri
    FROM deck_cards dc
    JOIN host_decks h ON h.deck_id = dc.deck_id
    JOIN printings p ON p.id = dc.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE c.oracle_id <> ${oracleId}
    GROUP BY c.oracle_id, c.name, c.mana_cost, c.type_line, c.edhrec_rank, c.card_faces
    ORDER BY co_decks DESC, c.edhrec_rank ASC NULLS LAST, c.name ASC
    LIMIT 24
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string | null;
    edhrec_rank: number | null;
    co_decks: number;
    owned_count: number;
    image_uri: string | null;
  }>;
  return rows.map((r) => ({
    oracleId: r.oracle_id,
    name: r.name,
    manaCost: r.mana_cost,
    typeLine: r.type_line,
    imageUri: r.image_uri,
    coDecks: r.co_decks,
    edhrecRank: r.edhrec_rank,
    ownedCount: r.owned_count,
  }));
}

export async function fetchOwnedRows(
  oracleId: string,
): Promise<InventoryRowWithCard[]> {
  const rows = (await db.execute(sql`
    SELECT
      i.id, i.printing_id, i.foil, i.etched, i.condition, i.language,
      i.location, i.physical_id, i.acquired_price, i.acquired_at,
      i.purchased_from, i.grading_company, i.grade, i.notes,
      i.disposed_to, i.disposed_price, i.disposed_at,
      i.created_at, i.updated_at,
      c.oracle_id, c.name, c.mana_cost, c.type_line, c.color_identity, c.cmc,
      c.is_commander_legal,
      p.set_code, p.set_name, p.collector_number, p.rarity,
      p.usd, p.usd_foil, p.usd_etched,
      COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE c.oracle_id = ${oracleId}
      AND i.disposed_at IS NULL
    ORDER BY p.released_at DESC, i.created_at DESC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r.id as string,
    printingId: r.printing_id as string,
    foil: r.foil as boolean,
    etched: r.etched as boolean,
    condition: r.condition as string,
    language: r.language as string,
    location: (r.location as string | null) ?? null,
    physicalId: (r.physical_id as string | null) ?? null,
    acquiredPrice: (r.acquired_price as string | null) ?? null,
    acquiredAt: toIso(r.acquired_at),
    purchasedFrom: (r.purchased_from as string | null) ?? null,
    gradingCompany: (r.grading_company as string | null) ?? null,
    grade: (r.grade as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    disposedTo: (r.disposed_to as string | null) ?? null,
    disposedPrice: (r.disposed_price as string | null) ?? null,
    disposedAt: toIso(r.disposed_at),
    createdAt: toIso(r.created_at) ?? "",
    updatedAt: toIso(r.updated_at) ?? "",
    oracleId: r.oracle_id as string,
    name: r.name as string,
    manaCost: (r.mana_cost as string | null) ?? null,
    typeLine: (r.type_line as string | null) ?? null,
    colorIdentity: (r.color_identity as string[] | null) ?? null,
    cmc: (r.cmc as string | null) ?? null,
    isCommanderLegal: (r.is_commander_legal as boolean | null) ?? null,
    setCode: r.set_code as string,
    setName: r.set_name as string,
    collectorNumber: r.collector_number as string,
    rarity: (r.rarity as string | null) ?? null,
    usd: (r.usd as string | null) ?? null,
    usdFoil: (r.usd_foil as string | null) ?? null,
    usdEtched: (r.usd_etched as string | null) ?? null,
    imageUri: (r.image_uri as string | null) ?? null,
  }));
}
