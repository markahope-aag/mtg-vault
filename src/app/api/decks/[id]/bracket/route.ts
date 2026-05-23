import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckSnapshots, decks } from "@/db/schema";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { calculateBracket } from "@/lib/bracket-engine";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Simple in-memory throttle (per-deck). Survives within a single serverless
// invocation; resets across cold starts. Good enough to stop accidental
// keyboard-mash recalculation, not a security boundary.
const lastCallByDeck = new Map<string, number>();
const MIN_INTERVAL_MS = 5000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const writeSnapshot = req.nextUrl.searchParams.get("writeSnapshot") !== "false";

  const last = lastCallByDeck.get(id);
  if (last && Date.now() - last < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { error: "Rate limited; wait a few seconds before recalculating." },
      { status: 429 },
    );
  }
  lastCallByDeck.set(id, Date.now());

  try {
    const detail = await fetchDeckDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const commanderOracleIds = [
      ...(detail.commander ? [detail.commander.oracleId] : []),
      ...(detail.partner ? [detail.partner.oracleId] : []),
    ];

    const result = await calculateBracket({
      deckId: id,
      cards: detail.cards.map((c) => ({
        oracleId: c.card.oracleId,
        quantity: c.deckCardRow.quantity,
      })),
      commanderOracleIds,
      commanderColorIdentity: detail.colorIdentity,
      declaredAsCedh: detail.deck.targetBracket === 5,
    });

    if (writeSnapshot) {
      const [snapshot] = await db
        .insert(deckSnapshots)
        .values({
          deckId: id,
          totalValueUsd: detail.totalValueUsd.toFixed(2),
          calculatedBracket: result.bracket,
          bracketReasons: {
            reasons: result.reasons,
            metrics: result.metrics,
            confidence: result.confidence,
            spellbookAvailable: result.spellbookAvailable,
            spellbookBracket: result.spellbookBracket,
          },
        })
        .returning();
      await db
        .update(decks)
        .set({ updatedAt: sql`now()` })
        .where(eq(decks.id, id));
      return NextResponse.json({
        ...result,
        snapshot: {
          id: snapshot.id,
          snapshotAt: snapshot.snapshotAt.toISOString(),
          totalValueUsd: detail.totalValueUsd,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return serverError("api/decks/id/bracket", err, "Couldn't compute bracket.");
  }
}
