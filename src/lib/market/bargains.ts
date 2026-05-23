/**
 * Bargain detector.
 *
 * Pure logic: given a list of want-list items + an array of MarketListings
 * per oracle id + a baseline price (the "what should this card cost" anchor),
 * return the listings that are meaningfully below baseline.
 *
 * "Meaningfully below" = at least minSavingsPct OR minSavingsUsd, whichever
 * is more lenient. Defaults are 15% and $2 — tuned so a $1.50 card has to
 * drop a lot to flag (otherwise pennies dominate the list) and a $300 card
 * flags on any modest discount.
 *
 * Source-agnostic. The eBay adapter's listings + a "price_history median"
 * baseline produce the strong signal; future LGS adapters drop in here too.
 */
import type { MarketListing } from "./source";

export type Bargain = {
  oracleId: string;
  name: string;
  baselineUsd: number;
  listing: MarketListing;
  /** baselineUsd - listing.priceUsd, in dollars. Positive = under
   *  baseline = bargain. */
  savingsUsd: number;
  savingsPct: number;
};

export type BargainInput = {
  wants: Array<{
    oracleId: string;
    name: string;
    /** Optional cap from manual want entry. Listings above this price
     *  are filtered out (never bargain to the user even if "under
     *  market") because the user already said no above $X. */
    maxPriceUsd?: number | null;
  }>;
  /** Baseline price the user considers fair / typical. Sourced from
   *  the trailing sold median when available (eBay Marketplace
   *  Insights), else the printing's price_history median, else
   *  printings.usd. */
  baselineByOracle: Map<string, number>;
  /** Listings indexed by oracle id. The adapter aligns listings to
   *  oracle ids during resolution; entries here are already-filtered. */
  listingsByOracle: Map<string, MarketListing[]>;
  /** Minimum savings percent (default 15%). */
  minSavingsPct?: number;
  /** Minimum absolute savings (default $2). */
  minSavingsUsd?: number;
  /** Confidence floor. Adapters score 0-1; below this, listings are
   *  dropped even if cheap (low confidence = probably mis-resolved or
   *  hostile flag set). */
  minConfidence?: number;
  /** Flags that disqualify a listing outright. By default: lots,
   *  graded, proxies, foreign-language. The user can opt to include
   *  these later if they want; bargain detection should be safe by
   *  default. */
  excludeFlags?: ReadonlyArray<string>;
};

const DEFAULT_EXCLUDE_FLAGS = [
  "possible_lot",
  "graded",
  "language_nonen",
  "playtest_proxy",
];

export function detectBargains(input: BargainInput): Bargain[] {
  const minSavingsPct = input.minSavingsPct ?? 15;
  const minSavingsUsd = input.minSavingsUsd ?? 2;
  const minConfidence = input.minConfidence ?? 0.5;
  const exclude = new Set(input.excludeFlags ?? DEFAULT_EXCLUDE_FLAGS);

  const bargains: Bargain[] = [];

  for (const want of input.wants) {
    const baseline = input.baselineByOracle.get(want.oracleId);
    if (!baseline || baseline <= 0) continue;
    const listings = input.listingsByOracle.get(want.oracleId) ?? [];
    for (const listing of listings) {
      if (listing.confidence < minConfidence) continue;
      if (listing.flags.some((f) => exclude.has(f))) continue;
      // Total cost = price + shipping. If the listing forgot to set
      // shipping, treat as free (be generous; many sellers absorb).
      const totalCost = listing.priceUsd + (listing.shippingUsd ?? 0);
      // Manual price ceiling — the user said "not above $X." Respect that
      // regardless of how good the relative discount is.
      if (want.maxPriceUsd != null && totalCost > want.maxPriceUsd) {
        continue;
      }
      const savings = baseline - totalCost;
      if (savings <= 0) continue;
      const savingsPct = (savings / baseline) * 100;
      // Tunable: hit EITHER the percent or the dollar threshold. A 14%
      // discount on a $200 card ($28 savings) is still a bargain; a 50%
      // discount on a $0.50 card ($0.25 savings) is noise.
      if (savings < minSavingsUsd && savingsPct < minSavingsPct) continue;
      bargains.push({
        oracleId: want.oracleId,
        name: want.name,
        baselineUsd: baseline,
        listing,
        savingsUsd: Math.round(savings * 100) / 100,
        savingsPct: Math.round(savingsPct * 10) / 10,
      });
    }
  }

  // Largest absolute savings first — the user reads the top of the list,
  // so put the biggest dollar wins there.
  bargains.sort((a, b) => b.savingsUsd - a.savingsUsd);
  return bargains;
}
