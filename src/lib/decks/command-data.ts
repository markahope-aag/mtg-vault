// Server-side data assembly for /decks/[id]/command. Reads cached state
// everywhere — no LLM, no bracket recalc, no live scraper hits. The three
// expensive refreshes (bracket / analysis / market) are explicit user-
// triggered buttons in the UI, not part of the page-load critical path.
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { decks, deckSnapshots } from "@/db/schema";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { reconcile, type ReconcileResult } from "@/lib/rogue/reconcile";
import {
  deckSignatureFromDetail,
  type DeckAnalysis,
} from "@/lib/ai/strategy";
import type { DeckDetail } from "@/lib/decks/types";
import { deckStats, type DeckStats } from "@/lib/games/queries";

export type ToReachBracketCut = {
  oracleId: string | null;
  name: string;
  reason: string;
  criticalForCombo?: string;
};

export type CachedBracket = {
  snapshotId: string | null;
  snapshotAt: string | null;
  calculatedBracket: number | null;
  targetBracket: number | null;
  reasons: Array<{
    severity: "blocking" | "limiting" | "note";
    text: string;
    category: string;
  }>;
  toReachBracket: Record<string, { remove: ToReachBracketCut[] }> | null;
  confidence: string | null;
};

export type CachedAnalysis = {
  analysis: DeckAnalysis | null;
  analyzedAt: string | null;
  signatureAtAnalysis: string | null;
  currentSignature: string;
  isStale: boolean;
};

export type MarketMover = {
  oracleId: string;
  name: string;
  printingId: string;
  setCode: string;
  imageUri: string | null;
  currentUsd: number;
  delta7dPct: number | null;
  delta30dPct: number | null;
};

export type CommandData = {
  detail: DeckDetail;
  bracket: CachedBracket;
  reconcile: ReconcileResult;
  analysis: CachedAnalysis;
  marketMovers: MarketMover[];
  gameStats: DeckStats | null;
};

async function loadCachedBracket(
  deckId: string,
  targetBracket: number | null,
): Promise<CachedBracket> {
  const [snap] = await db
    .select({
      id: deckSnapshots.id,
      snapshotAt: deckSnapshots.snapshotAt,
      calculatedBracket: deckSnapshots.calculatedBracket,
      bracketReasons: deckSnapshots.bracketReasons,
    })
    .from(deckSnapshots)
    .where(eq(deckSnapshots.deckId, deckId))
    .orderBy(desc(deckSnapshots.snapshotAt))
    .limit(1);

  if (!snap) {
    return {
      snapshotId: null,
      snapshotAt: null,
      calculatedBracket: null,
      targetBracket,
      reasons: [],
      toReachBracket: null,
      confidence: null,
    };
  }
  // bracketReasons is a JSONB blob; the shape mirrors what
  // /api/decks/[id]/bracket persists. Older snapshots may not have
  // toReachBracket — surfaces as null and the UI hides the cut list.
  const blob = (snap.bracketReasons ?? {}) as {
    reasons?: CachedBracket["reasons"];
    confidence?: string;
    toReachBracket?: CachedBracket["toReachBracket"];
  };
  return {
    snapshotId: snap.id,
    snapshotAt: snap.snapshotAt.toISOString(),
    calculatedBracket: snap.calculatedBracket,
    targetBracket,
    reasons: blob.reasons ?? [],
    toReachBracket: blob.toReachBracket ?? null,
    confidence: blob.confidence ?? null,
  };
}

async function loadCachedAnalysis(
  deckId: string,
  currentSignature: string,
): Promise<CachedAnalysis> {
  const [row] = await db
    .select({
      analysis: decks.analysis,
      analyzedAt: decks.analyzedAt,
      signatureAtAnalysis: decks.analysisSignature,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  const analyzedAt = row?.analyzedAt?.toISOString() ?? null;
  const signatureAtAnalysis = row?.signatureAtAnalysis ?? null;
  return {
    analysis: (row?.analysis as DeckAnalysis | null) ?? null,
    analyzedAt,
    signatureAtAnalysis,
    currentSignature,
    isStale:
      analyzedAt != null &&
      signatureAtAnalysis != null &&
      signatureAtAnalysis !== currentSignature,
  };
}

// Pull recent price history for the deck's TOP-N most valuable printings
// and turn it into a 7d / 30d % delta. Reads price_history (already
// populated by the daily snapshot job), no live scrape.
async function loadMarketMovers(
  deckId: string,
  topN = 8,
): Promise<MarketMover[]> {
  // Cheapest path: pick top printings by current usd, then JOIN price_history
  // at 7d-ago and 30d-ago dates. price_history rows are dated YYYY-MM-DD
  // text keys; we accept the closest row on-or-before each cutoff.
  const rows = (await db.execute(sql`
    WITH deck_printings AS (
      SELECT DISTINCT dc.printing_id, p.oracle_id, c.name, p.set_code,
             p.image_uris, p.card_faces, p.usd::numeric AS usd
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE dc.deck_id = ${deckId}
        AND p.usd IS NOT NULL
        AND p.usd::numeric > 1
    ),
    ranked AS (
      SELECT * FROM deck_printings
      ORDER BY usd DESC NULLS LAST
      LIMIT ${topN}
    ),
    h7 AS (
      SELECT DISTINCT ON (ph.printing_id)
        ph.printing_id, ph.usd::numeric AS usd
      FROM price_history ph
      JOIN ranked r ON r.printing_id = ph.printing_id
      WHERE ph.date <= TO_CHAR(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')
      ORDER BY ph.printing_id, ph.date DESC
    ),
    h30 AS (
      SELECT DISTINCT ON (ph.printing_id)
        ph.printing_id, ph.usd::numeric AS usd
      FROM price_history ph
      JOIN ranked r ON r.printing_id = ph.printing_id
      WHERE ph.date <= TO_CHAR(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
      ORDER BY ph.printing_id, ph.date DESC
    )
    SELECT
      r.printing_id, r.oracle_id, r.name, r.set_code, r.usd,
      COALESCE(r.image_uris ->> 'small', r.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
      h7.usd  AS usd_7d_ago,
      h30.usd AS usd_30d_ago
    FROM ranked r
    LEFT JOIN h7  ON h7.printing_id  = r.printing_id
    LEFT JOIN h30 ON h30.printing_id = r.printing_id
    ORDER BY r.usd DESC NULLS LAST
  `)) as unknown as Array<{
    printing_id: string;
    oracle_id: string;
    name: string;
    set_code: string;
    usd: string | null;
    image_uri: string | null;
    usd_7d_ago: string | null;
    usd_30d_ago: string | null;
  }>;

  return rows.map((r) => {
    const usd = r.usd ? Number.parseFloat(r.usd) : 0;
    const p7 = r.usd_7d_ago ? Number.parseFloat(r.usd_7d_ago) : null;
    const p30 = r.usd_30d_ago ? Number.parseFloat(r.usd_30d_ago) : null;
    const delta7dPct =
      p7 != null && p7 > 0 ? ((usd - p7) / p7) * 100 : null;
    const delta30dPct =
      p30 != null && p30 > 0 ? ((usd - p30) / p30) * 100 : null;
    return {
      oracleId: r.oracle_id,
      name: r.name,
      printingId: r.printing_id,
      setCode: r.set_code,
      imageUri: r.image_uri,
      currentUsd: usd,
      delta7dPct,
      delta30dPct,
    };
  });
}

// Run reconcile against the deck itself (excludeDeckId = this deck) so
// the deck's own commitments don't count against it. Quantity is
// preserved by repeating oracle ids — matches the existing pattern in
// /api/decks/[id]/reconcile/route.ts.
async function loadDeckReconcile(
  deckId: string,
  detail: DeckDetail,
): Promise<ReconcileResult> {
  const targetOracleIds: string[] = [];
  for (const c of detail.cards) {
    for (let i = 0; i < c.deckCardRow.quantity; i++) {
      targetOracleIds.push(c.card.oracleId);
    }
  }
  if (detail.commander) targetOracleIds.push(detail.commander.oracleId);
  if (detail.partner) targetOracleIds.push(detail.partner.oracleId);

  return reconcile({
    targetOracleIds,
    excludeDeckId: deckId,
  });
}

export async function loadCommandData(deckId: string): Promise<CommandData | null> {
  const detail = await fetchDeckDetail(deckId);
  if (!detail) return null;
  const currentSignature = deckSignatureFromDetail(detail);

  // Everything else is independent — fire in parallel.
  const [bracket, reconcileResult, analysis, marketMovers, gameStats] =
    await Promise.all([
      loadCachedBracket(deckId, detail.deck.targetBracket ?? null),
      loadDeckReconcile(deckId, detail),
      loadCachedAnalysis(deckId, currentSignature),
      loadMarketMovers(deckId),
      deckStats(deckId).catch(() => null),
    ]);

  return {
    detail,
    bracket,
    reconcile: reconcileResult,
    analysis,
    marketMovers,
    gameStats,
  };
}

