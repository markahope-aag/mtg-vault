import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { reconcile } from "@/lib/rogue/reconcile";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Standalone reconcile view for an EXISTING deck. Phase A free bonus:
 * "what does keeping this deck built actually cost me, and what's
 * contested with my other decks?"
 *
 * excludeDeckId = the deck itself, so the deck's own commitments don't
 * count against itself in the contention math.
 *
 * Query params:
 *   priceThreshold (optional, default 5)
 *   protectedDeckIds (optional, csv of uuids)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Pull every printing in the deck (main + maybeboard + considering),
    // expand to oracle ids with each row repeated by quantity so basics
    // and any-number-allowed cards carry their counts through.
    const cardRows = (await db.execute(sql`
      SELECT
        p.oracle_id,
        dc.quantity
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      WHERE dc.deck_id = ${id}
    `)) as unknown as Array<{ oracle_id: string; quantity: number }>;

    // Include the commander + partner if present, since they're stored on
    // decks rather than deck_cards.
    const deckRows = (await db.execute(sql`
      SELECT
        cmd_p.oracle_id AS commander_oracle_id,
        partner_p.oracle_id AS partner_oracle_id
      FROM decks d
      LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
      LEFT JOIN printings partner_p ON partner_p.id = d.partner_printing_id
      WHERE d.id = ${id}
      LIMIT 1
    `)) as unknown as Array<{
      commander_oracle_id: string | null;
      partner_oracle_id: string | null;
    }>;
    if (deckRows.length === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const targetOracleIds: string[] = [];
    for (const r of cardRows) {
      for (let i = 0; i < r.quantity; i++) targetOracleIds.push(r.oracle_id);
    }
    if (deckRows[0].commander_oracle_id) {
      targetOracleIds.push(deckRows[0].commander_oracle_id);
    }
    if (deckRows[0].partner_oracle_id) {
      targetOracleIds.push(deckRows[0].partner_oracle_id);
    }

    const priceThresholdRaw = req.nextUrl.searchParams.get("priceThreshold");
    const priceThreshold = priceThresholdRaw
      ? Number.parseFloat(priceThresholdRaw)
      : undefined;
    const protectedRaw = req.nextUrl.searchParams.get("protectedDeckIds");
    const protectedDeckIds = protectedRaw
      ? protectedRaw.split(",").filter(Boolean)
      : undefined;

    const result = await reconcile({
      targetOracleIds,
      protectedDeckIds,
      priceThreshold,
      excludeDeckId: id,
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError(
      "api/decks/id/reconcile",
      err,
      "Reconcile failed.",
    );
  }
}
