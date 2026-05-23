import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { toIso } from "@/lib/utils";
import type { NormalizedRow } from "./types";

export type ResolverPrinting = {
  id: string;
  oracleId: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  imageUri: string | null;
  releasedAt: string | null;
  name: string;
};

export type ResolutionResult =
  | { status: "matched"; printing: ResolverPrinting }
  | {
      status: "ambiguous";
      candidates: Array<{ printing: ResolverPrinting; score: number }>;
    }
  | { status: "unmatched"; reason: string };

type RawPrintingRow = {
  id: string;
  oracle_id: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  rarity: string | null;
  usd: string | null;
  usd_foil: string | null;
  image_uri: string | null;
  released_at: Date | null;
  name: string;
};

function toPrinting(r: RawPrintingRow): ResolverPrinting {
  return {
    id: r.id,
    oracleId: r.oracle_id,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    rarity: r.rarity,
    usd: r.usd,
    usdFoil: r.usd_foil,
    imageUri: r.image_uri,
    releasedAt: toIso(r.released_at),
    name: r.name,
  };
}

const BASE_SELECT = sql`
  SELECT p.id, p.oracle_id, p.set_code, p.set_name, p.collector_number,
         p.rarity, p.usd, p.usd_foil,
         COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
         p.released_at, c.name
  FROM printings p
  JOIN cards c ON c.oracle_id = p.oracle_id
`;

function scoreCandidate(p: ResolverPrinting, row: NormalizedRow): number {
  let score = 0;
  if (p.collectorNumber === row.collectorNumber) score += 100;
  else if (p.collectorNumber.startsWith(row.collectorNumber)) score += 30;
  if (p.releasedAt) score += new Date(p.releasedAt).getTime() / 1e12;
  return score;
}

export async function resolvePrinting(
  row: NormalizedRow,
): Promise<ResolutionResult> {
  // a. Direct scryfall id lookup
  if (row.scryfallId) {
    const rows = (await db.execute(sql`
      ${BASE_SELECT}
      WHERE p.id = ${row.scryfallId}
      LIMIT 1
    `)) as unknown as RawPrintingRow[];
    if (rows.length === 1) {
      return { status: "matched", printing: toPrinting(rows[0]) };
    }
  }

  // b. set_code + collector_number
  if (row.setCode && row.collectorNumber) {
    const rows = (await db.execute(sql`
      ${BASE_SELECT}
      WHERE LOWER(p.set_code) = ${row.setCode.toLowerCase()}
        AND p.collector_number = ${row.collectorNumber}
    `)) as unknown as RawPrintingRow[];
    if (rows.length === 1) {
      return { status: "matched", printing: toPrinting(rows[0]) };
    }
    if (rows.length > 1) {
      return {
        status: "ambiguous",
        candidates: rows
          .map((r) => toPrinting(r))
          .map((p) => ({ printing: p, score: scoreCandidate(p, row) }))
          .sort((a, b) => b.score - a.score),
      };
    }
  }

  // c. name + set_code → printings of that name in that set
  if (row.name && row.setCode) {
    const rows = (await db.execute(sql`
      ${BASE_SELECT}
      WHERE LOWER(c.name) = ${row.name.toLowerCase()}
        AND LOWER(p.set_code) = ${row.setCode.toLowerCase()}
    `)) as unknown as RawPrintingRow[];
    if (rows.length === 1) {
      return { status: "matched", printing: toPrinting(rows[0]) };
    }
    if (rows.length > 1) {
      return {
        status: "ambiguous",
        candidates: rows
          .map((r) => toPrinting(r))
          .map((p) => ({ printing: p, score: scoreCandidate(p, row) }))
          .sort((a, b) => b.score - a.score),
      };
    }
  }

  // d. name only → all printings of that card as candidates
  if (row.name) {
    const rows = (await db.execute(sql`
      ${BASE_SELECT}
      WHERE LOWER(c.name) = ${row.name.toLowerCase()}
      ORDER BY p.released_at DESC NULLS LAST
      LIMIT 50
    `)) as unknown as RawPrintingRow[];
    if (rows.length === 1) {
      return { status: "matched", printing: toPrinting(rows[0]) };
    }
    if (rows.length > 1) {
      return {
        status: "ambiguous",
        candidates: rows
          .map((r) => toPrinting(r))
          .map((p) => ({ printing: p, score: scoreCandidate(p, row) }))
          .sort((a, b) => b.score - a.score),
      };
    }
  }

  return { status: "unmatched", reason: "card name not found" };
}
