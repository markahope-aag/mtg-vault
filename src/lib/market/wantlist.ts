/**
 * Want list assembly.
 *
 * Two sources of "I want this card":
 *   1. Manual entries in the `wants` table — explicit additions with
 *      optional max-price + notes.
 *   2. Cards your decks need but your inventory doesn't cover. Derived
 *      from deck_cards minus oracle_ownership. Each underlying deck's
 *      contribution is summed (one card needed by two decks = quantity 2
 *      on the want list).
 *
 * The union is returned with quantity-target = manual targetQuantity +
 * deck-need shortfall, and a `sources` array per card naming which
 * mechanism contributed (so the UI can show "needed by 2 decks + manual").
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type WantSource = "manual" | "deck_need";

export type WantEntry = {
  oracleId: string;
  name: string;
  setCode: string | null;
  imageUri: string | null;
  /** Total copies the user wants (manual target + deck shortfall). */
  targetQuantity: number;
  /** From manual entries only. UI uses this to flag "I won't pay more
   *  than $X." */
  maxPriceUsd: number | null;
  notes: string | null;
  sources: WantSource[];
  /** Which decks contribute to the shortfall, for UI surfacing. */
  contributingDecks: Array<{ deckId: string; deckName: string; qty: number }>;
  /** Current printing.usd (non-foil) as a baseline; the bargain detector
   *  uses this as the fallback baseline when no source has sold data. */
  currentMarketUsd: number | null;
};

export async function fetchWantList(): Promise<WantEntry[]> {
  // Three concurrent queries: manual wants, deck-need aggregation, and the
  // ownership counts that turn "deck quantity" into "shortfall." Combine
  // by oracle id in memory.

  const manualRows = (await db.execute(sql`
    SELECT
      w.oracle_id,
      w.target_quantity,
      w.max_price_usd,
      w.notes,
      c.name,
      (
        SELECT COALESCE(
          p.image_uris ->> 'small',
          p.card_faces -> 0 -> 'image_uris' ->> 'small'
        )
        FROM printings p
        WHERE p.oracle_id = w.oracle_id
        ORDER BY p.released_at DESC NULLS LAST, p.set_code
        LIMIT 1
      ) AS image_uri,
      (
        SELECT p.set_code
        FROM printings p
        WHERE p.oracle_id = w.oracle_id
        ORDER BY p.released_at DESC NULLS LAST, p.set_code
        LIMIT 1
      ) AS set_code,
      (
        SELECT p.usd::numeric
        FROM printings p
        WHERE p.oracle_id = w.oracle_id AND p.usd IS NOT NULL
        ORDER BY p.usd::numeric ASC
        LIMIT 1
      ) AS current_market
    FROM wants w
    JOIN cards c ON c.oracle_id = w.oracle_id
  `)) as unknown as Array<{
    oracle_id: string;
    target_quantity: number;
    max_price_usd: string | null;
    notes: string | null;
    name: string;
    image_uri: string | null;
    set_code: string | null;
    current_market: string | null;
  }>;

  const deckNeedRows = (await db.execute(sql`
    -- For each (oracle, deck) pair: total quantity the deck wants vs
    -- the user's owned count. Surface only the positive shortfall.
    WITH per_deck AS (
      SELECT
        d.id AS deck_id,
        d.name AS deck_name,
        p.oracle_id,
        SUM(dc.quantity)::int AS need_qty
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      JOIN decks d ON d.id = dc.deck_id
      GROUP BY d.id, d.name, p.oracle_id
    ),
    owned AS (
      SELECT oracle_id, owned_count FROM oracle_ownership
    )
    SELECT
      per_deck.deck_id,
      per_deck.deck_name,
      per_deck.oracle_id,
      per_deck.need_qty,
      COALESCE(owned.owned_count, 0)::int AS owned_count,
      c.name,
      (
        SELECT COALESCE(
          p.image_uris ->> 'small',
          p.card_faces -> 0 -> 'image_uris' ->> 'small'
        )
        FROM printings p
        WHERE p.oracle_id = per_deck.oracle_id
        ORDER BY p.released_at DESC NULLS LAST, p.set_code
        LIMIT 1
      ) AS image_uri,
      (
        SELECT p.set_code
        FROM printings p
        WHERE p.oracle_id = per_deck.oracle_id
        ORDER BY p.released_at DESC NULLS LAST, p.set_code
        LIMIT 1
      ) AS set_code,
      (
        SELECT p.usd::numeric
        FROM printings p
        WHERE p.oracle_id = per_deck.oracle_id AND p.usd IS NOT NULL
        ORDER BY p.usd::numeric ASC
        LIMIT 1
      ) AS current_market
    FROM per_deck
    LEFT JOIN owned ON owned.oracle_id = per_deck.oracle_id
    JOIN cards c ON c.oracle_id = per_deck.oracle_id
    WHERE per_deck.need_qty > COALESCE(owned.owned_count, 0)
  `)) as unknown as Array<{
    deck_id: string;
    deck_name: string;
    oracle_id: string;
    need_qty: number;
    owned_count: number;
    name: string;
    image_uri: string | null;
    set_code: string | null;
    current_market: string | null;
  }>;

  // Aggregate deck-need by oracle: per-deck shortfall caps at need - owned,
  // summed across decks (because each deck wants its own copy).
  type Aggregate = {
    name: string;
    imageUri: string | null;
    setCode: string | null;
    currentMarketUsd: number | null;
    deckShortfall: number;
    decks: WantEntry["contributingDecks"];
  };
  const byOracle = new Map<string, Aggregate>();

  // Track total owned per oracle so we don't double-count across decks
  // when computing the GLOBAL shortfall. If you own 1 Sol Ring and two
  // decks each want 1, the GLOBAL shortfall is 1 (the second deck), not
  // 2 (which would imply you need to buy two).
  const totalOwned = new Map<string, number>();
  const totalDeckNeed = new Map<string, number>();
  for (const r of deckNeedRows) {
    totalOwned.set(r.oracle_id, r.owned_count);
    totalDeckNeed.set(
      r.oracle_id,
      (totalDeckNeed.get(r.oracle_id) ?? 0) + r.need_qty,
    );
  }

  for (const r of deckNeedRows) {
    const entry = byOracle.get(r.oracle_id) ?? {
      name: r.name,
      imageUri: r.image_uri,
      setCode: r.set_code,
      currentMarketUsd: r.current_market
        ? Number.parseFloat(r.current_market)
        : null,
      deckShortfall: 0,
      decks: [],
    };
    entry.decks.push({
      deckId: r.deck_id,
      deckName: r.deck_name,
      qty: r.need_qty,
    });
    byOracle.set(r.oracle_id, entry);
  }
  // Resolve the per-oracle shortfall from the aggregates (don't sum
  // per-deck shortfalls — that overcounts when one card is needed by
  // multiple decks).
  for (const [oracleId, entry] of byOracle) {
    const need = totalDeckNeed.get(oracleId) ?? 0;
    const owned = totalOwned.get(oracleId) ?? 0;
    entry.deckShortfall = Math.max(0, need - owned);
  }

  // Merge in manual wants. Same-oracle entries combine sources + extend
  // targetQuantity by the manual target.
  const manualByOracle = new Map<string, (typeof manualRows)[number]>();
  for (const m of manualRows) manualByOracle.set(m.oracle_id, m);

  const allOracleIds = new Set<string>([
    ...byOracle.keys(),
    ...manualByOracle.keys(),
  ]);

  const out: WantEntry[] = [];
  for (const oracleId of allOracleIds) {
    const deckEntry = byOracle.get(oracleId);
    const manualEntry = manualByOracle.get(oracleId);
    const sources: WantSource[] = [];
    if (deckEntry && deckEntry.deckShortfall > 0) sources.push("deck_need");
    if (manualEntry) sources.push("manual");
    const targetQty =
      (manualEntry?.target_quantity ?? 0) +
      (deckEntry?.deckShortfall ?? 0);
    if (targetQty === 0) continue; // nothing to want
    out.push({
      oracleId,
      name: deckEntry?.name ?? manualEntry?.name ?? "(unknown)",
      setCode: deckEntry?.setCode ?? manualEntry?.set_code ?? null,
      imageUri: deckEntry?.imageUri ?? manualEntry?.image_uri ?? null,
      targetQuantity: targetQty,
      maxPriceUsd: manualEntry?.max_price_usd
        ? Number.parseFloat(manualEntry.max_price_usd)
        : null,
      notes: manualEntry?.notes ?? null,
      sources,
      contributingDecks: deckEntry?.decks ?? [],
      currentMarketUsd:
        deckEntry?.currentMarketUsd ??
        (manualEntry?.current_market
          ? Number.parseFloat(manualEntry.current_market)
          : null),
    });
  }

  // Highest market-value wants first — those are the slots where bargain
  // detection has the most absolute upside.
  out.sort(
    (a, b) => (b.currentMarketUsd ?? 0) - (a.currentMarketUsd ?? 0),
  );
  return out;
}
