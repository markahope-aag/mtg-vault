/**
 * Bargain sweep — orchestrates the want list + market sources + baseline
 * lookups into a single set of Bargain rows ready for the UI.
 *
 * This is where the source layer meets the deterministic detector.
 * Each enabled source is queried for each want; results merge into a
 * by-oracle map and feed into detectBargains. Baselines prefer
 * trailing sold median (when any source has hasSoldData) over
 * price_history median over printings.usd.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ensureSourcesLoaded, marketSources } from "./registry";
import { detectBargains, type Bargain } from "./bargains";
import { fetchWantList, type WantEntry } from "./wantlist";
import type { MarketListing } from "./source";

export type BargainSweepResult = {
  bargains: Bargain[];
  /** Wants we couldn't get any listings for (no source had data, or
   *  every listing was filtered). UI surfaces these so the user can
   *  see "we tried but nothing came back." */
  unmetWants: WantEntry[];
  /** Diagnostic: per-source counts. */
  sourceStats: Array<{
    sourceId: string;
    enabled: boolean;
    listingCount: number;
    errorCount: number;
  }>;
};

export async function sweepBargains(opts: {
  wantLimit?: number;
  /** Override the per-source listing fetch cap for testing. */
  perWantLimit?: number;
} = {}): Promise<BargainSweepResult> {
  // Make sure scraper adapters from market_sources are registered
  // before we iterate the registry. Idempotent.
  await ensureSourcesLoaded();
  const wants = (await fetchWantList()).slice(0, opts.wantLimit ?? 50);
  if (wants.length === 0) {
    return {
      bargains: [],
      unmetWants: [],
      sourceStats: marketSources.all().map((s) => ({
        sourceId: s.id,
        enabled: s.enabled,
        listingCount: 0,
        errorCount: 0,
      })),
    };
  }

  // Baseline lookup. For now, use price_history median per oracle id
  // (last 90 days). Falls back to printings.usd when no history exists.
  // Once a source has hasSoldData = true, swap to trailing sold median
  // from market_listings cache.
  const baselineByOracle = new Map<string, number>();
  const oracleList = wants.map((w) => w.oracleId);
  if (oracleList.length > 0) {
    const baselines = (await db.execute(sql`
      WITH median AS (
        SELECT
          p.oracle_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ph.usd::numeric) AS p50
        FROM price_history ph
        JOIN printings p ON p.id = ph.printing_id
        WHERE ph.usd IS NOT NULL
          AND ph.date >= (now() - interval '90 days')::date::text
          AND p.oracle_id = ANY(ARRAY[${sql.join(
            oracleList.map((o) => sql`${o}::uuid`),
            sql`, `,
          )}])
        GROUP BY p.oracle_id
      ),
      fallback AS (
        SELECT DISTINCT ON (p.oracle_id)
          p.oracle_id,
          p.usd::numeric AS usd
        FROM printings p
        WHERE p.usd IS NOT NULL
          AND p.oracle_id = ANY(ARRAY[${sql.join(
            oracleList.map((o) => sql`${o}::uuid`),
            sql`, `,
          )}])
        ORDER BY p.oracle_id, p.usd::numeric ASC
      )
      SELECT
        f.oracle_id,
        COALESCE(m.p50, f.usd)::numeric(12, 2) AS baseline
      FROM fallback f
      LEFT JOIN median m ON m.oracle_id = f.oracle_id
    `)) as unknown as Array<{ oracle_id: string; baseline: string | null }>;
    for (const b of baselines) {
      if (b.baseline) {
        baselineByOracle.set(b.oracle_id, Number.parseFloat(b.baseline));
      }
    }
  }

  // Query every enabled source for every want. Per-source rate limits are
  // adapter-internal; the orchestrator runs sources in parallel but
  // wants serially within a source so we don't slam any one provider.
  const listingsByOracle = new Map<string, MarketListing[]>();
  const sourceStats: BargainSweepResult["sourceStats"] = marketSources
    .all()
    .map((s) => ({
      sourceId: s.id,
      enabled: s.enabled,
      listingCount: 0,
      errorCount: 0,
    }));

  for (const want of wants) {
    const perSource = await Promise.all(
      marketSources.enabled().map(async (source) => {
        try {
          const listings = await source.search({
            name: want.name,
            oracleId: want.oracleId,
            limit: opts.perWantLimit ?? 25,
          });
          return { sourceId: source.id, listings, error: false };
        } catch {
          return { sourceId: source.id, listings: [], error: true };
        }
      }),
    );
    for (const r of perSource) {
      const stat = sourceStats.find((s) => s.sourceId === r.sourceId);
      if (stat) {
        stat.listingCount += r.listings.length;
        if (r.error) stat.errorCount += 1;
      }
      // Lock each listing's oracle id to the want we queried for; the
      // adapter may not resolve titles back to oracle ids itself.
      for (const l of r.listings) {
        if (!l.oracleId) l.oracleId = want.oracleId;
      }
      const prev = listingsByOracle.get(want.oracleId) ?? [];
      listingsByOracle.set(want.oracleId, [...prev, ...r.listings]);
    }
  }

  const bargains = detectBargains({
    wants,
    baselineByOracle,
    listingsByOracle,
  });

  const wantsWithBargains = new Set(bargains.map((b) => b.oracleId));
  const unmetWants = wants.filter((w) => !wantsWithBargains.has(w.oracleId));

  return { bargains, unmetWants, sourceStats };
}
