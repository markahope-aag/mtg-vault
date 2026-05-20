import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckCards, decks } from "@/db/schema";
import { upsertDeckCardSchema } from "@/lib/decks/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = upsertDeckCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { printingId, category, delta, set } = parsed.data;

  try {
    const deckExists = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.id, id))
      .limit(1);
    if (deckExists.length === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Find existing slot
    const existing = await db
      .select()
      .from(deckCards)
      .where(
        and(
          eq(deckCards.deckId, id),
          eq(deckCards.printingId, printingId),
          eq(deckCards.category, category),
        ),
      )
      .limit(1);
    const current = existing[0];

    let targetQuantity: number;
    if (set != null) targetQuantity = set;
    else targetQuantity = (current?.quantity ?? 0) + (delta ?? 0);
    if (targetQuantity < 0) targetQuantity = 0;

    if (targetQuantity === 0) {
      if (current) {
        await db
          .delete(deckCards)
          .where(
            and(
              eq(deckCards.deckId, id),
              eq(deckCards.printingId, printingId),
              eq(deckCards.category, category),
            ),
          );
      }
      await db
        .update(decks)
        .set({ updatedAt: sql`now()` })
        .where(eq(decks.id, id));
      return NextResponse.json({ row: null, deleted: true });
    }

    if (current) {
      const [updated] = await db
        .update(deckCards)
        .set({ quantity: targetQuantity })
        .where(
          and(
            eq(deckCards.deckId, id),
            eq(deckCards.printingId, printingId),
            eq(deckCards.category, category),
          ),
        )
        .returning();
      await db
        .update(decks)
        .set({ updatedAt: sql`now()` })
        .where(eq(decks.id, id));
      return NextResponse.json({ row: updated });
    }

    const [inserted] = await db
      .insert(deckCards)
      .values({
        deckId: id,
        printingId,
        quantity: targetQuantity,
        category,
      })
      .returning();
    await db
      .update(decks)
      .set({ updatedAt: sql`now()` })
      .where(eq(decks.id, id));
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    console.error("[api/decks cards POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
