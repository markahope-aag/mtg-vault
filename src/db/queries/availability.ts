import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type AvailabilityEntry = {
  owned: number;
  committedTotal: number;
  committedExcluding: number;
  available: number;
};

export type AvailabilityMap = Record<string, AvailabilityEntry>;

export async function getAvailability(
  oracleIds: string[],
  excludingDeckId?: string,
): Promise<AvailabilityMap> {
  if (oracleIds.length === 0) return {};

  const rows = (await db.execute(sql`
    WITH src AS (
      SELECT UNNEST(${oracleIds}::uuid[]) AS oracle_id
    )
    SELECT
      src.oracle_id,
      COALESCE(o.owned_count, 0)::int AS owned,
      COALESCE(SUM(dc.committed_qty), 0)::int AS committed_total,
      COALESCE(
        SUM(dc.committed_qty) FILTER (WHERE ${excludingDeckId ? sql`dc.deck_id <> ${excludingDeckId}::uuid` : sql`true`}),
        0
      )::int AS committed_excluding
    FROM src
    LEFT JOIN oracle_ownership o ON o.oracle_id = src.oracle_id
    LEFT JOIN deck_commitments dc ON dc.oracle_id = src.oracle_id
    GROUP BY src.oracle_id, o.owned_count
  `)) as unknown as Array<{
    oracle_id: string;
    owned: number;
    committed_total: number;
    committed_excluding: number;
  }>;

  const map: AvailabilityMap = {};
  for (const r of rows) {
    map[r.oracle_id] = {
      owned: r.owned,
      committedTotal: r.committed_total,
      committedExcluding: r.committed_excluding,
      available: Math.max(0, r.owned - r.committed_excluding),
    };
  }
  return map;
}
