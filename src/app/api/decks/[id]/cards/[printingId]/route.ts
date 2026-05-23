import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckCards, decks } from "@/db/schema";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; printingId: string }> },
) {
  const { id, printingId } = await params;
  const category = req.nextUrl.searchParams.get("category") ?? "main";
  try {
    const deleted = await db
      .delete(deckCards)
      .where(
        and(
          eq(deckCards.deckId, id),
          eq(deckCards.printingId, printingId),
          eq(deckCards.category, category),
        ),
      )
      .returning({ printingId: deckCards.printingId });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db
      .update(decks)
      .set({ updatedAt: sql`now()` })
      .where(eq(decks.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("api/decks/id/cards/printingId", err, "Couldn't update that card.");
  }
}
