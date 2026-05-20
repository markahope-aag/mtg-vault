import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionSnapshots } from "@/db/schema";

export type CollectionValue = {
  totalCards: number;
  uniqueCards: number;
  foilCount: number;
  marketValueUsd: number;
  costBasisUsd: number;
  unrealizedGainUsd: number;
  realizedGainUsd: number;
  realizedProceedsUsd: number;
};

export async function computeCollectionValue(): Promise<CollectionValue> {
  const rows = (await db.execute(sql`
    WITH live AS (
      SELECT
        COUNT(*)::int AS total_cards,
        COUNT(*) FILTER (WHERE i.foil = true)::int AS foil_count,
        COUNT(DISTINCT p.oracle_id)::int AS unique_cards,
        COALESCE(SUM(
          CASE
            WHEN i.etched = true THEN COALESCE(p.usd_etched::numeric, 0)
            WHEN i.foil = true THEN COALESCE(p.usd_foil::numeric, 0)
            ELSE COALESCE(p.usd::numeric, 0)
          END
        ), 0) AS market_value,
        COALESCE(SUM(COALESCE(i.acquired_price::numeric, 0)), 0) AS cost_basis
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      WHERE i.disposed_at IS NULL
    ),
    realized AS (
      SELECT
        COALESCE(
          SUM(
            COALESCE(i.disposed_price::numeric, 0)
            - COALESCE(i.acquired_price::numeric, 0)
          ),
          0
        ) AS realized_gain,
        COALESCE(SUM(COALESCE(i.disposed_price::numeric, 0)), 0)
          AS realized_proceeds
      FROM inventory i
      WHERE i.disposed_at IS NOT NULL
    )
    SELECT live.*, realized.realized_gain, realized.realized_proceeds
    FROM live, realized
  `)) as unknown as Array<{
    total_cards: number;
    foil_count: number;
    unique_cards: number;
    market_value: string;
    cost_basis: string;
    realized_gain: string;
    realized_proceeds: string;
  }>;
  const r = rows[0];
  if (!r) {
    return {
      totalCards: 0,
      uniqueCards: 0,
      foilCount: 0,
      marketValueUsd: 0,
      costBasisUsd: 0,
      unrealizedGainUsd: 0,
      realizedGainUsd: 0,
      realizedProceedsUsd: 0,
    };
  }
  const market = Number.parseFloat(String(r.market_value)) || 0;
  const cost = Number.parseFloat(String(r.cost_basis)) || 0;
  return {
    totalCards: r.total_cards,
    uniqueCards: r.unique_cards,
    foilCount: r.foil_count,
    marketValueUsd: market,
    costBasisUsd: cost,
    unrealizedGainUsd: market - cost,
    realizedGainUsd: Number.parseFloat(String(r.realized_gain)) || 0,
    realizedProceedsUsd: Number.parseFloat(String(r.realized_proceeds)) || 0,
  };
}

export async function upsertTodaysCollectionSnapshot(): Promise<{
  date: string;
  value: CollectionValue;
}> {
  const value = await computeCollectionValue();
  const date = new Date().toISOString().slice(0, 10);
  await db
    .insert(collectionSnapshots)
    .values({
      date,
      totalCards: value.totalCards,
      marketValueUsd: value.marketValueUsd.toFixed(2),
      costBasisUsd: value.costBasisUsd.toFixed(2),
      foilCount: value.foilCount,
      uniqueCards: value.uniqueCards,
    })
    .onConflictDoUpdate({
      target: collectionSnapshots.date,
      set: {
        totalCards: value.totalCards,
        marketValueUsd: value.marketValueUsd.toFixed(2),
        costBasisUsd: value.costBasisUsd.toFixed(2),
        foilCount: value.foilCount,
        uniqueCards: value.uniqueCards,
      },
    });
  return { date, value };
}
