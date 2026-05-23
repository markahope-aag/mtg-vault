/**
 * Collection valuation intelligence — Phase B feature #4.
 *
 * Three views, all queryable today without eBay sold data:
 *   - Appreciated: cards your acquired_price was lower than current market
 *     by more than a configurable threshold. Sell signals.
 *   - Movers: biggest week-over-week deltas pulled from price_history.
 *     Cards that are *moving*, regardless of whether you should sell.
 *   - Underwater: cards where current market is below your cost basis.
 *     Hold/loss view — useful for tax-loss reasoning and not panic-selling.
 *
 * All three use printings.usd as the current price proxy. When eBay
 * Marketplace Insights is wired up (sold-listing medians), the
 * Appreciated + Underwater views should switch to that signal — the
 * function shape stays identical.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type AppreciatedRow = {
  inventoryId: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUri: string | null;
  foil: boolean;
  condition: string;
  acquiredPriceUsd: number;
  currentMarketUsd: number;
  gainUsd: number;
  gainPct: number;
};

export type MoverRow = {
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUri: string | null;
  priceFromUsd: number;
  priceToUsd: number;
  deltaUsd: number;
  deltaPct: number;
  ownedCount: number;
};

export type UnderwaterRow = {
  inventoryId: string;
  oracleId: string;
  name: string;
  setCode: string;
  imageUri: string | null;
  foil: boolean;
  acquiredPriceUsd: number;
  currentMarketUsd: number;
  lossUsd: number;
  lossPct: number;
};

/**
 * Cards in your inventory whose current market exceeds their acquired
 * price by ≥ minGainPct (default 25%). Only counts non-disposed rows.
 *
 * Joins to printings for current price; uses the finish-aware price
 * (usd_foil for foils where present, else usd).
 */
export async function appreciatedCards(opts: {
  minGainPct?: number;
  minGainUsd?: number;
  limit?: number;
}): Promise<AppreciatedRow[]> {
  const minGainPct = opts.minGainPct ?? 25;
  const minGainUsd = opts.minGainUsd ?? 1;
  const limit = opts.limit ?? 50;

  const rows = (await db.execute(sql`
    WITH cur AS (
      SELECT
        i.id AS inventory_id,
        p.oracle_id,
        c.name,
        p.set_code,
        p.set_name,
        p.collector_number,
        COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
        i.foil,
        i.condition,
        i.acquired_price::numeric AS acquired_price,
        CASE
          WHEN i.foil THEN COALESCE(p.usd_foil::numeric, p.usd::numeric)
          ELSE p.usd::numeric
        END AS current_market
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.disposed_at IS NULL
        AND i.acquired_price IS NOT NULL
        AND i.acquired_price::numeric > 0
    )
    SELECT
      inventory_id, oracle_id, name, set_code, set_name, collector_number,
      image_uri, foil, condition,
      acquired_price, current_market,
      (current_market - acquired_price)::numeric(12, 2) AS gain_usd,
      ((current_market - acquired_price) / acquired_price * 100)::numeric(12, 2) AS gain_pct
    FROM cur
    WHERE current_market IS NOT NULL
      AND current_market > acquired_price
      AND (current_market - acquired_price) >= ${minGainUsd}
      AND ((current_market - acquired_price) / acquired_price * 100) >= ${minGainPct}
    ORDER BY (current_market - acquired_price) DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    inventory_id: string;
    oracle_id: string;
    name: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_uri: string | null;
    foil: boolean;
    condition: string;
    acquired_price: string;
    current_market: string;
    gain_usd: string;
    gain_pct: string;
  }>;

  return rows.map((r) => ({
    inventoryId: r.inventory_id,
    oracleId: r.oracle_id,
    name: r.name,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    imageUri: r.image_uri,
    foil: r.foil,
    condition: r.condition,
    acquiredPriceUsd: Number.parseFloat(r.acquired_price),
    currentMarketUsd: Number.parseFloat(r.current_market),
    gainUsd: Number.parseFloat(r.gain_usd),
    gainPct: Number.parseFloat(r.gain_pct),
  }));
}

/**
 * Biggest week-over-week price movers across cards you own at least one of.
 * Pulls today's snapshot vs 7 days ago from price_history (foil-aware via
 * inventory.foil — a foil mover is different from a non-foil mover).
 *
 * Cards without a 7-day window in price_history are excluded — the
 * weekly sync only fully populates after at least a week of runs.
 */
export async function topMovers(opts: {
  days?: number;
  limit?: number;
  /** Both directions; pass 'up' or 'down' to filter. */
  direction?: "up" | "down" | "either";
}): Promise<MoverRow[]> {
  const days = opts.days ?? 7;
  const limit = opts.limit ?? 30;
  const direction = opts.direction ?? "either";

  // Use the most recent price_history snapshot per (printing, foil-bucket)
  // joined with the closest snapshot N days before.
  const directionFilter =
    direction === "up"
      ? sql`AND delta > 0`
      : direction === "down"
        ? sql`AND delta < 0`
        : sql``;

  const rows = (await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (ph.printing_id)
        ph.printing_id,
        ph.date,
        ph.usd::numeric AS usd,
        ph.usd_foil::numeric AS usd_foil
      FROM price_history ph
      ORDER BY ph.printing_id, ph.date DESC
    ),
    prior AS (
      SELECT DISTINCT ON (ph.printing_id)
        ph.printing_id,
        ph.date,
        ph.usd::numeric AS usd,
        ph.usd_foil::numeric AS usd_foil
      FROM price_history ph
      WHERE ph.date <= (now() - (${days} || ' days')::interval)::date::text
      ORDER BY ph.printing_id, ph.date DESC
    ),
    -- Aggregate ownership per oracle so we only surface cards the user owns.
    owned AS (
      SELECT p.oracle_id, COUNT(*)::int AS owned_count
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      WHERE i.disposed_at IS NULL
      GROUP BY p.oracle_id
    )
    SELECT
      p.oracle_id, c.name, p.set_code, p.set_name, p.collector_number,
      COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
      prior.usd AS price_from,
      latest.usd AS price_to,
      (latest.usd - prior.usd) AS delta,
      CASE WHEN prior.usd > 0
        THEN ((latest.usd - prior.usd) / prior.usd * 100)
        ELSE 0 END AS delta_pct,
      owned.owned_count
    FROM latest
    JOIN prior ON prior.printing_id = latest.printing_id
    JOIN printings p ON p.id = latest.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    JOIN owned ON owned.oracle_id = p.oracle_id
    WHERE latest.usd IS NOT NULL AND prior.usd IS NOT NULL
      AND prior.usd > 0
      AND latest.usd <> prior.usd
      ${directionFilter}
    ORDER BY ABS(latest.usd - prior.usd) DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_uri: string | null;
    price_from: string;
    price_to: string;
    delta: string;
    delta_pct: string;
    owned_count: number;
  }>;

  return rows.map((r) => ({
    oracleId: r.oracle_id,
    name: r.name,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    imageUri: r.image_uri,
    priceFromUsd: Number.parseFloat(r.price_from),
    priceToUsd: Number.parseFloat(r.price_to),
    deltaUsd: Number.parseFloat(r.delta),
    deltaPct: Number.parseFloat(r.delta_pct),
    ownedCount: r.owned_count,
  }));
}

/**
 * Cards in your inventory where current market is below your acquired
 * price. The "hold view" — useful for thinking about cost basis without
 * panicking, and for tax-loss harvesting reasoning.
 */
export async function underwaterCards(opts: {
  minLossPct?: number;
  limit?: number;
}): Promise<UnderwaterRow[]> {
  const minLossPct = opts.minLossPct ?? 10;
  const limit = opts.limit ?? 50;

  const rows = (await db.execute(sql`
    WITH cur AS (
      SELECT
        i.id AS inventory_id,
        p.oracle_id,
        c.name,
        p.set_code,
        COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
        i.foil,
        i.acquired_price::numeric AS acquired_price,
        CASE
          WHEN i.foil THEN COALESCE(p.usd_foil::numeric, p.usd::numeric)
          ELSE p.usd::numeric
        END AS current_market
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.disposed_at IS NULL
        AND i.acquired_price IS NOT NULL
        AND i.acquired_price::numeric > 0
    )
    SELECT
      inventory_id, oracle_id, name, set_code, image_uri, foil,
      acquired_price, current_market,
      (acquired_price - current_market)::numeric(12, 2) AS loss_usd,
      ((acquired_price - current_market) / acquired_price * 100)::numeric(12, 2) AS loss_pct
    FROM cur
    WHERE current_market IS NOT NULL
      AND current_market < acquired_price
      AND ((acquired_price - current_market) / acquired_price * 100) >= ${minLossPct}
    ORDER BY (acquired_price - current_market) DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    inventory_id: string;
    oracle_id: string;
    name: string;
    set_code: string;
    image_uri: string | null;
    foil: boolean;
    acquired_price: string;
    current_market: string;
    loss_usd: string;
    loss_pct: string;
  }>;

  return rows.map((r) => ({
    inventoryId: r.inventory_id,
    oracleId: r.oracle_id,
    name: r.name,
    setCode: r.set_code,
    imageUri: r.image_uri,
    foil: r.foil,
    acquiredPriceUsd: Number.parseFloat(r.acquired_price),
    currentMarketUsd: Number.parseFloat(r.current_market),
    lossUsd: Number.parseFloat(r.loss_usd),
    lossPct: Number.parseFloat(r.loss_pct),
  }));
}
