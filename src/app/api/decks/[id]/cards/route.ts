import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { deckCards, decks } from "@/db/schema";
import { upsertDeckCardSchema } from "@/lib/decks/schemas";

export const dynamic = "force-dynamic";

const moveSchema = z.object({
  printingId: z.string().uuid(),
  fromCategory: z.string().trim().min(1).max(30),
  toCategory: z.string().trim().min(1).max(30),
});

export async function PATCH(
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
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { printingId, fromCategory, toCategory } = parsed.data;
  if (fromCategory === toCategory) {
    return NextResponse.json({ ok: true, unchanged: true });
  }
  try {
    const existing = await db
      .select()
      .from(deckCards)
      .where(
        and(
          eq(deckCards.deckId, id),
          eq(deckCards.printingId, printingId),
          eq(deckCards.category, fromCategory),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const source = existing[0];

    // If a row already exists at toCategory, merge quantities.
    const target = await db
      .select()
      .from(deckCards)
      .where(
        and(
          eq(deckCards.deckId, id),
          eq(deckCards.printingId, printingId),
          eq(deckCards.category, toCategory),
        ),
      )
      .limit(1);

    if (target.length > 0) {
      await db
        .update(deckCards)
        .set({ quantity: target[0].quantity + source.quantity })
        .where(
          and(
            eq(deckCards.deckId, id),
            eq(deckCards.printingId, printingId),
            eq(deckCards.category, toCategory),
          ),
        );
      await db
        .delete(deckCards)
        .where(
          and(
            eq(deckCards.deckId, id),
            eq(deckCards.printingId, printingId),
            eq(deckCards.category, fromCategory),
          ),
        );
    } else {
      await db
        .update(deckCards)
        .set({ category: toCategory })
        .where(
          and(
            eq(deckCards.deckId, id),
            eq(deckCards.printingId, printingId),
            eq(deckCards.category, fromCategory),
          ),
        );
    }
    await db
      .update(decks)
      .set({ updatedAt: sql`now()` })
      .where(eq(decks.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/decks cards PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

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
