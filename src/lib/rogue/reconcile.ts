/**
 * Reconciliation engine for the Rogue Deck Builder.
 *
 * Pure function over a list of oracle ids — no AI, no side effects.
 * Computes what a target deck would actually cost the user given their
 * current inventory and existing deck commitments, then projects four
 * "what-if" scenarios on top.
 *
 * Used by:
 * - Phase A standalone view: reconcile against an existing deck (excludeDeckId
 *   = itself) to surface "what does keeping this deck built actually cost me."
 * - Phase B/C generators: reconcile against a generated proposal to drive
 *   shopping list + decks-impacted UX before the proposal is saved.
 *
 * Design rules:
 * - Buckets describe one oracle id at a time. Quantity is handled at the
 *   input layer (passing the same id twice = wanting 2 copies).
 * - Pre-existing contention is reported SEPARATELY from new demand the
 *   target deck creates. Conflating them confuses the numbers.
 * - The target counts as the Nth claimant for contention math but is NOT a
 *   real deck_commitments row, so we add 1 to claim counts manually.
 * - Basics and any-number-allowed cards are unlimited; always available_now.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sqlArray } from "@/lib/sql";
import {
  ANY_NUMBER_ALLOWED_NAMES,
  BASIC_LAND_NAMES,
} from "@/lib/curated/any-number-allowed";

export type CardBucket =
  | "available_now"
  | "movable"
  | "contested"
  | "must_buy";

export type HeldByDeck = {
  deckId: string;
  deckName: string;
  qty: number;
  isProtected: boolean;
};

export type ReconciledCard = {
  oracleId: string;
  name: string;
  bucket: CardBucket;
  ownedCount: number;
  committedTotal: number;
  cheapestPrintingId: string | null;
  cheapestUsd: number | null;
  heldByDecks: HeldByDeck[];
  /** Number of copies the target asks for (e.g. 30 for Mountain). */
  requested: number;
  /** True for basic lands + ANY_NUMBER_ALLOWED names (skip cost / contention math). */
  isUnlimited: boolean;
};

export type ReconcileInput = {
  targetOracleIds: string[];
  protectedDeckIds?: string[];
  priceThreshold?: number;
  /** If reconciling against an existing deck's contents, pass its id here so
   *  the deck's own commitments aren't double-counted as "competing." */
  excludeDeckId?: string;
};

export type Scenario = {
  key: string;
  label: string;
  shoppingList: Array<{
    oracleId: string;
    name: string;
    cheapestUsd: number | null;
  }>;
  totalCostUsd: number;
  cardsPulledFromDecks: Array<{
    oracleId: string;
    name: string;
    fromDeck: string;
  }>;
  decksImpacted: Array<{
    deckId: string;
    deckName: string;
    cardsLost: number;
  }>;
};

export type ReconcileSummary = {
  totalCards: number;
  ownedUnassigned: number;
  movableCount: number;
  mustBuyCount: number;
  cheapestCompletionUsd: number;
};

export type ReconcileResult = {
  buckets: Record<CardBucket, ReconciledCard[]>;
  preExistingContention: Array<{
    oracleId: string;
    name: string;
    ownedCount: number;
    claimedByDecks: number;
  }>;
  scenarios: Record<string, Scenario>;
  summary: ReconcileSummary;
};

type DbRow = {
  oracle_id: string;
  name: string;
  type_line: string | null;
  owned_count: number;
  committed_total: number;
  cheapest_printing_id: string | null;
  cheapest_usd: string | null;
  held_by: Array<{
    deckId: string;
    deckName: string;
    qty: number;
    isPrimary: boolean;
  }> | null;
};

function isUnlimitedName(name: string): boolean {
  return BASIC_LAND_NAMES.has(name) || ANY_NUMBER_ALLOWED_NAMES.has(name);
}

/**
 * Bucket assignment for a single oracle id, given its ownership/commitment
 * state and the protected-deck set. Pure — no DB access. Exported for tests
 * so the bucket boundaries are pinned independent of SQL plumbing.
 *
 * Resolution order matters:
 *   1. isUnlimited → available_now (basics, Rat Colony, etc.)
 *   2. ownedCount = 0 → must_buy
 *   3. committedTotal > ownedCount → contested. This is the pre-existing
 *      over-claim case: even if the proposal pulls a copy, some other deck
 *      remains short. Surface as contested so the user knows.
 *   4. free copies satisfy requested → available_now
 *   5. We own enough in aggregate but all are committed elsewhere:
 *        - any non-protected holder → movable
 *        - all holders protected → must_buy (we can't touch them)
 *
 * Why `committedTotal > ownedCount` rather than "claimants exceed owned":
 * if we own 1 and one other deck holds it, the proposal can pull it cleanly
 * — that's the movable case. Counting the proposal as a separate claimant
 * here would wrongly bucket every simple movable card as contested.
 */
export function bucketFor(input: {
  ownedCount: number;
  committedTotal: number;
  heldByDecks: HeldByDeck[];
  requested: number;
  protectedDeckIds: ReadonlySet<string>;
  isUnlimited: boolean;
}): CardBucket {
  if (input.isUnlimited) return "available_now";
  if (input.ownedCount === 0) return "must_buy";
  if (input.committedTotal > input.ownedCount) return "contested";

  const free = input.ownedCount - input.committedTotal;
  if (free >= input.requested) return "available_now";

  const anyNonProtected = input.heldByDecks.some(
    (h) => !input.protectedDeckIds.has(h.deckId) && !h.isProtected,
  );
  return anyNonProtected ? "movable" : "must_buy";
}

export async function reconcile(
  input: ReconcileInput,
): Promise<ReconcileResult> {
  if (input.targetOracleIds.length === 0) {
    return {
      buckets: {
        available_now: [],
        movable: [],
        contested: [],
        must_buy: [],
      },
      preExistingContention: [],
      scenarios: {},
      summary: {
        totalCards: 0,
        ownedUnassigned: 0,
        movableCount: 0,
        mustBuyCount: 0,
        cheapestCompletionUsd: 0,
      },
    };
  }

  // Count duplicates in the input so quantity (basics: 30 Mountain) is
  // preserved through to the bucket math even though we resolve per
  // unique oracle id.
  const requestedByOracle = new Map<string, number>();
  for (const id of input.targetOracleIds) {
    requestedByOracle.set(id, (requestedByOracle.get(id) ?? 0) + 1);
  }
  const uniqueOracleIds = [...requestedByOracle.keys()];

  const excludeDeckClause = input.excludeDeckId
    ? sql`AND dc.deck_id <> ${input.excludeDeckId}::uuid`
    : sql``;

  const rows = (await db.execute(sql`
    WITH targets AS (
      SELECT UNNEST(${sqlArray(uniqueOracleIds, "uuid")}::uuid[]) AS oracle_id
    ),
    commitments AS (
      SELECT
        dc.oracle_id,
        SUM(dc.committed_qty)::int AS committed_total,
        json_agg(json_build_object(
          'deckId',   dc.deck_id,
          'deckName', d.name,
          'qty',      dc.committed_qty,
          'isPrimary', COALESCE(d.is_primary, false)
        ) ORDER BY d.name) AS held_by
      FROM deck_commitments dc
      JOIN decks d ON d.id = dc.deck_id
      WHERE dc.oracle_id IN (SELECT oracle_id FROM targets)
        ${excludeDeckClause}
      GROUP BY dc.oracle_id
    ),
    cheapest AS (
      -- Cheapest printing per oracle id. Prefer the non-foil price; fall
      -- back to foil only if no non-foil printing has any usd at all.
      SELECT DISTINCT ON (p.oracle_id)
        p.oracle_id,
        p.id AS printing_id,
        COALESCE(p.usd::numeric, p.usd_foil::numeric) AS usd
      FROM printings p
      WHERE p.oracle_id IN (SELECT oracle_id FROM targets)
        AND (p.usd IS NOT NULL OR p.usd_foil IS NOT NULL)
      ORDER BY
        p.oracle_id,
        (p.usd IS NULL) ASC,  -- prefer rows where non-foil usd exists
        COALESCE(p.usd::numeric, p.usd_foil::numeric) ASC
    )
    SELECT
      t.oracle_id,
      c.name,
      c.type_line,
      COALESCE(o.owned_count, 0)::int AS owned_count,
      COALESCE(co.committed_total, 0)::int AS committed_total,
      ch.printing_id AS cheapest_printing_id,
      ch.usd::text AS cheapest_usd,
      co.held_by
    FROM targets t
    JOIN cards c ON c.oracle_id = t.oracle_id
    LEFT JOIN oracle_ownership o ON o.oracle_id = t.oracle_id
    LEFT JOIN commitments co ON co.oracle_id = t.oracle_id
    LEFT JOIN cheapest ch ON ch.oracle_id = t.oracle_id
  `)) as unknown as DbRow[];

  const protectedSet = new Set(input.protectedDeckIds ?? []);

  const buckets: Record<CardBucket, ReconciledCard[]> = {
    available_now: [],
    movable: [],
    contested: [],
    must_buy: [],
  };
  const preExistingContention: ReconcileResult["preExistingContention"] = [];

  for (const r of rows) {
    const requested = requestedByOracle.get(r.oracle_id) ?? 1;
    const isBasic = /Basic Land/i.test(r.type_line ?? "");
    const isUnlimited = isBasic || isUnlimitedName(r.name);
    const heldByDecks: HeldByDeck[] = (r.held_by ?? []).map((h) => ({
      deckId: h.deckId,
      deckName: h.deckName,
      qty: h.qty,
      // "Protected" = explicitly listed by the caller OR marked primary.
      isProtected: protectedSet.has(h.deckId) || !!h.isPrimary,
    }));
    const protectedForCard = new Set(
      heldByDecks.filter((h) => h.isProtected).map((h) => h.deckId),
    );

    const card: ReconciledCard = {
      oracleId: r.oracle_id,
      name: r.name,
      bucket: bucketFor({
        ownedCount: r.owned_count,
        committedTotal: r.committed_total,
        heldByDecks,
        requested,
        protectedDeckIds: protectedForCard,
        isUnlimited,
      }),
      ownedCount: r.owned_count,
      committedTotal: r.committed_total,
      cheapestPrintingId: r.cheapest_printing_id,
      cheapestUsd:
        r.cheapest_usd != null ? Number.parseFloat(r.cheapest_usd) : null,
      heldByDecks,
      requested,
      isUnlimited,
    };
    buckets[card.bucket].push(card);

    // Pre-existing contention is "existing decks already over-claim this
    // card BEFORE the proposal adds its own demand." It's not specific to
    // the bucket assignment above; it's a separate signal the user wants
    // to see so they don't blame the proposal for an existing conflict.
    if (!isUnlimited && r.committed_total > r.owned_count) {
      preExistingContention.push({
        oracleId: r.oracle_id,
        name: r.name,
        ownedCount: r.owned_count,
        claimedByDecks: heldByDecks.length,
      });
    }
  }

  const scenarios = buildScenarios(buckets, input);
  const summary = buildSummary(buckets, scenarios);

  return { buckets, preExistingContention, scenarios, summary };
}

// ─── Scenarios ──────────────────────────────────────────────────

function buildScenarios(
  buckets: Record<CardBucket, ReconciledCard[]>,
  input: ReconcileInput,
): Record<string, Scenario> {
  return {
    buy_everything: scenarioBuyEverything(buckets),
    cannibalize_freely: scenarioCannibalize(buckets, new Set()),
    price_threshold_split: scenarioPriceSplit(buckets, input.priceThreshold),
    protect_primary: scenarioCannibalize(
      buckets,
      // "Protect primary" defaults to any deck that's both currently holding
      // a card AND is marked primary. Caller can override via
      // protectedDeckIds, in which case those decks are also protected in
      // the per-card bucket math upstream — here we just project the
      // already-bucketed cards.
      new Set(
        Object.values(buckets)
          .flat()
          .flatMap((c) => c.heldByDecks.filter((h) => h.isProtected).map((h) => h.deckId)),
      ),
    ),
  };
}

function priceOf(c: ReconciledCard): number {
  return c.cheapestUsd ?? 0;
}

function scenarioBuyEverything(
  buckets: Record<CardBucket, ReconciledCard[]>,
): Scenario {
  // Existing decks untouched. The bound here is the lower bound — only
  // includes cards you own zero of. Movable + contested cards stay where
  // they are; the proposal is "incomplete" by that count.
  const list = buckets.must_buy.filter((c) => !c.isUnlimited);
  return {
    key: "buy_everything",
    label: "Buy everything (decks untouched)",
    shoppingList: list.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      cheapestUsd: c.cheapestUsd,
    })),
    totalCostUsd: list.reduce((s, c) => s + priceOf(c), 0),
    cardsPulledFromDecks: [],
    decksImpacted: [],
  };
}

function scenarioCannibalize(
  buckets: Record<CardBucket, ReconciledCard[]>,
  protectedDeckIds: ReadonlySet<string>,
): Scenario {
  // Pull every movable card out of its current deck. Anything still
  // contested (claimants > ownedCount) or in must_buy still needs to be
  // bought. Cards held only by protected decks are NOT pulled — they
  // join the shopping list instead.
  const pulledFromDecks: Scenario["cardsPulledFromDecks"] = [];
  const decksLostCounts = new Map<string, { name: string; count: number }>();
  const shopping: ReconciledCard[] = [];

  for (const card of buckets.movable) {
    if (card.isUnlimited) continue;
    const nonProtected = card.heldByDecks.find(
      (h) => !protectedDeckIds.has(h.deckId) && !h.isProtected,
    );
    if (nonProtected) {
      pulledFromDecks.push({
        oracleId: card.oracleId,
        name: card.name,
        fromDeck: nonProtected.deckName,
      });
      const entry = decksLostCounts.get(nonProtected.deckId) ?? {
        name: nonProtected.deckName,
        count: 0,
      };
      entry.count += 1;
      decksLostCounts.set(nonProtected.deckId, entry);
    } else {
      // All holders are protected — must buy a new copy.
      shopping.push(card);
    }
  }
  for (const card of buckets.must_buy) {
    if (!card.isUnlimited) shopping.push(card);
  }
  for (const card of buckets.contested) {
    // Contested cards beyond owned count: we'd need to either pull from a
    // non-protected deck (one copy of the over-claim) AND buy the rest, or
    // just buy them outright. The conservative call is to add them to the
    // shopping list — this scenario is the "I'd rather pay than untangle."
    if (!card.isUnlimited) shopping.push(card);
  }

  return {
    key: protectedDeckIds.size > 0 ? "protect_primary" : "cannibalize_freely",
    label:
      protectedDeckIds.size > 0
        ? "Cannibalize, but protect primary decks"
        : "Cannibalize freely",
    shoppingList: shopping.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      cheapestUsd: c.cheapestUsd,
    })),
    totalCostUsd: shopping.reduce((s, c) => s + priceOf(c), 0),
    cardsPulledFromDecks: pulledFromDecks,
    decksImpacted: [...decksLostCounts.entries()].map(([deckId, e]) => ({
      deckId,
      deckName: e.name,
      cardsLost: e.count,
    })),
  };
}

function scenarioPriceSplit(
  buckets: Record<CardBucket, ReconciledCard[]>,
  threshold = 5,
): Scenario {
  // Same shopping list as buy_everything but partitioned at the threshold
  // so the UI can show "cheap completion" vs "expensive completion."
  // Threshold defaults to $5 — a sensible split between bulk and chase
  // cards, but the caller can pass anything.
  const list = buckets.must_buy.filter((c) => !c.isUnlimited);
  const cheap = list.filter((c) => priceOf(c) < threshold);
  const expensive = list.filter((c) => priceOf(c) >= threshold);
  return {
    key: "price_threshold_split",
    label: `Split at $${threshold.toFixed(2)} (cheap vs chase)`,
    shoppingList: [...cheap, ...expensive].map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      cheapestUsd: c.cheapestUsd,
    })),
    totalCostUsd: list.reduce((s, c) => s + priceOf(c), 0),
    cardsPulledFromDecks: [],
    decksImpacted: [
      { deckId: "__cheap__", deckName: `Under $${threshold}`, cardsLost: cheap.length },
      {
        deckId: "__expensive__",
        deckName: `$${threshold} and up`,
        cardsLost: expensive.length,
      },
    ],
  };
}

function buildSummary(
  buckets: Record<CardBucket, ReconciledCard[]>,
  scenarios: Record<string, Scenario>,
): ReconcileSummary {
  const totalCards = Object.values(buckets).reduce(
    (s, b) => s + b.reduce((n, c) => n + c.requested, 0),
    0,
  );
  return {
    totalCards,
    ownedUnassigned: buckets.available_now.length,
    movableCount: buckets.movable.length,
    mustBuyCount: buckets.must_buy.length,
    // Cheapest path to a complete deck: the cannibalize scenario's total —
    // that's what you'd actually pay if you were willing to pull from
    // existing non-protected decks.
    cheapestCompletionUsd: scenarios.cannibalize_freely?.totalCostUsd ?? 0,
  };
}
