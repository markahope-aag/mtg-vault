import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckSnapshots, decks } from "@/db/schema";
import { fetchDeckDetail } from "@/lib/decks/queries";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const detail = await fetchDeckDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [snapshot] = await db
      .insert(deckSnapshots)
      .values({
        deckId: id,
        totalValueUsd: detail.totalValueUsd.toFixed(2),
        calculatedBracket: null,
        bracketReasons: null,
      })
      .returning();
    await db
      .update(decks)
      .set({ updatedAt: sql`now()` })
      .where(eq(decks.id, id));
    return NextResponse.json({ snapshot });
  } catch (err) {
    return serverError("api/decks/id/snapshot", err, "Couldn't save snapshot.");
  }
}
