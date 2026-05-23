import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { reconcile } from "@/lib/rogue/reconcile";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Run the Phase A reconciliation engine on a generated proposal's card list.
 * The proposal counts as a new claimant (not yet committed to deck_cards),
 * so we DON'T pass excludeDeckId here — every other real deck competes
 * for the user's inventory normally.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await db
      .select({
        cardList: deckProposals.cardList,
      })
      .from(deckProposals)
      .where(eq(deckProposals.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || !row.cardList) {
      return NextResponse.json(
        { error: "Proposal not found or empty" },
        { status: 404 },
      );
    }

    const cardList = row.cardList as Array<{
      oracleId: string;
      name: string;
    }>;
    const targetOracleIds = cardList.map((c) => c.oracleId);

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
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError(
      "api/proposals/id/reconcile",
      err,
      "Reconcile failed.",
    );
  }
}
