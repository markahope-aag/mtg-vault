import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionSnapshots } from "@/db/schema";

export type DailySnapshot = {
  date: string;
  marketValueUsd: number;
  costBasisUsd: number | null;
  totalCards: number;
  uniqueCards: number | null;
};

export async function fetchSnapshots(
  rangeDays: number | null,
): Promise<DailySnapshot[]> {
  const cutoff =
    rangeDays != null
      ? new Date(Date.now() - rangeDays * 86_400_000).toISOString().slice(0, 10)
      : null;
  const rows = cutoff
    ? await db
        .select()
        .from(collectionSnapshots)
        .where(sql`date >= ${cutoff}`)
        .orderBy(collectionSnapshots.date)
    : await db
        .select()
        .from(collectionSnapshots)
        .orderBy(collectionSnapshots.date);
  return rows.map((r) => ({
    date: r.date,
    marketValueUsd: Number.parseFloat(r.marketValueUsd) || 0,
    costBasisUsd: r.costBasisUsd != null ? Number.parseFloat(r.costBasisUsd) : null,
    totalCards: r.totalCards,
    uniqueCards: r.uniqueCards,
  }));
}

export type TopCard = {
  oracleId: string;
  printingId: string;
  name: string;
  setCode: string;
  setName: string;
  imageUri: string | null;
  unitPriceUsd: number;
  count: number;
  totalValueUsd: number;
};

export async function fetchTopCardsByValue(limit = 20): Promise<TopCard[]> {
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id, p.id AS printing_id, c.name, p.set_code, p.set_name,
      (p.image_uris ->> 'small') AS image_uri,
      COUNT(*)::int AS count,
      AVG(
        CASE
          WHEN i.etched THEN COALESCE(p.usd_etched::numeric, 0)
          WHEN i.foil THEN COALESCE(p.usd_foil::numeric, 0)
          ELSE COALESCE(p.usd::numeric, 0)
        END
      )::numeric(10,2) AS unit_price,
      SUM(
        CASE
          WHEN i.etched THEN COALESCE(p.usd_etched::numeric, 0)
          WHEN i.foil THEN COALESCE(p.usd_foil::numeric, 0)
          ELSE COALESCE(p.usd::numeric, 0)
        END
      )::numeric(12,2) AS total_value
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE i.disposed_at IS NULL
    GROUP BY c.oracle_id, p.id, c.name, p.set_code, p.set_name, p.image_uris
    ORDER BY total_value DESC NULLS LAST
    LIMIT ${limit}
  `)) as unknown as Array<{
    oracle_id: string;
    printing_id: string;
    name: string;
    set_code: string;
    set_name: string;
    image_uri: string | null;
    count: number;
    unit_price: string;
    total_value: string;
  }>;
  return rows.map((r) => ({
    oracleId: r.oracle_id,
    printingId: r.printing_id,
    name: r.name,
    setCode: r.set_code,
    setName: r.set_name,
    imageUri: r.image_uri,
    count: r.count,
    unitPriceUsd: Number.parseFloat(r.unit_price) || 0,
    totalValueUsd: Number.parseFloat(r.total_value) || 0,
  }));
}

export type DeckSummary = {
  id: string;
  name: string;
  commanderName: string | null;
  commanderImage: string | null;
  targetBracket: number | null;
  calculatedBracket: number | null;
  totalCards: number;
  totalValueUsd: number;
};

export async function fetchDeckSummaries(): Promise<DeckSummary[]> {
  const rows = (await db.execute(sql`
    SELECT
      d.id, d.name, d.target_bracket,
      cmd.name AS commander_name,
      (cmd_p.image_uris ->> 'small') AS commander_image,
      (
        SELECT calculated_bracket
        FROM deck_snapshots ds
        WHERE ds.deck_id = d.id
        ORDER BY ds.snapshot_at DESC
        LIMIT 1
      ) AS calculated_bracket,
      COALESCE(stats.total_cards, 0)::int AS total_cards,
      COALESCE(stats.total_value, 0)::numeric(14,2) AS total_value
    FROM decks d
    LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
    LEFT JOIN cards cmd ON cmd.oracle_id = cmd_p.oracle_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(dc.quantity), 0)
          + CASE WHEN d.commander_printing_id IS NULL THEN 0 ELSE 1 END
          + CASE WHEN d.partner_printing_id   IS NULL THEN 0 ELSE 1 END
          AS total_cards,
        COALESCE(SUM(dc.quantity * COALESCE(p.usd::numeric, 0)), 0)
          + COALESCE(cmd_p.usd::numeric, 0)
          AS total_value
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      WHERE dc.deck_id = d.id
    ) stats ON TRUE
    ORDER BY total_value DESC NULLS LAST
  `)) as unknown as Array<{
    id: string;
    name: string;
    target_bracket: number | null;
    commander_name: string | null;
    commander_image: string | null;
    calculated_bracket: number | null;
    total_cards: number;
    total_value: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    commanderName: r.commander_name,
    commanderImage: r.commander_image,
    targetBracket: r.target_bracket,
    calculatedBracket: r.calculated_bracket,
    totalCards: r.total_cards,
    totalValueUsd: Number.parseFloat(r.total_value) || 0,
  }));
}

export type Insight = { label: string; count: number };

export async function fetchInsights(): Promise<{
  colorDistribution: Insight[];
  typeDistribution: Insight[];
  topSets: Insight[];
}> {
  const [colors, types, sets] = await Promise.all([
    db.execute(sql`
      SELECT
        CASE
          WHEN c.color_identity IS NULL OR array_length(c.color_identity, 1) IS NULL THEN 'Colorless'
          WHEN array_length(c.color_identity, 1) > 1 THEN 'Multicolor'
          ELSE c.color_identity[1]
        END AS label,
        COUNT(*)::int AS count
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.disposed_at IS NULL
      GROUP BY label
      ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT
        CASE
          WHEN c.type_line ILIKE '%Creature%' THEN 'Creatures'
          WHEN c.type_line ILIKE '%Planeswalker%' THEN 'Planeswalkers'
          WHEN c.type_line ILIKE '%Battle%' THEN 'Battles'
          WHEN c.type_line ILIKE '%Instant%' THEN 'Instants'
          WHEN c.type_line ILIKE '%Sorcery%' THEN 'Sorceries'
          WHEN c.type_line ILIKE '%Artifact%' THEN 'Artifacts'
          WHEN c.type_line ILIKE '%Enchantment%' THEN 'Enchantments'
          WHEN c.type_line ILIKE '%Land%' THEN 'Lands'
          ELSE 'Other'
        END AS label,
        COUNT(*)::int AS count
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.disposed_at IS NULL
      GROUP BY label
      ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT UPPER(p.set_code) AS label, COUNT(*)::int AS count
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      WHERE i.disposed_at IS NULL
      GROUP BY p.set_code
      ORDER BY count DESC
      LIMIT 10
    `),
  ]);
  return {
    colorDistribution: (colors as unknown as Insight[]).map((r) => ({
      label: r.label,
      count: r.count,
    })),
    typeDistribution: (types as unknown as Insight[]).map((r) => ({
      label: r.label,
      count: r.count,
    })),
    topSets: (sets as unknown as Insight[]).map((r) => ({
      label: r.label,
      count: r.count,
    })),
  };
}
