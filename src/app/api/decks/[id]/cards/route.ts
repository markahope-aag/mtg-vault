import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { cards, deckCards, decks, printings } from "@/db/schema";
import {
  moveDeckCardSchema,
  upsertDeckCardSchema,
} from "@/lib/decks/schemas";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

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
  const parsed = moveDeckCardSchema.safeParse(body);
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
    // The merge path below (source category has a row + target
    // category also has a row of the same printing) is two writes:
    // UPDATE target.quantity += source.quantity, then DELETE source.
    // If the DELETE fails after the UPDATE commits, the source row
    // stays AND the target now has doubled quantity — duplicate
    // count, silent data drift. Wrap the whole move (including the
    // pre-read of source/target inside the same snapshot, plus the
    // deck.updatedAt bump) in a single transaction so partial
    // failures roll back as a unit.
    const result = await db.transaction(async (tx) => {
      const existing = await tx
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
        return { notFound: true as const };
      }
      const source = existing[0];

      // If a row already exists at toCategory, merge quantities.
      const target = await tx
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
        await tx
          .update(deckCards)
          .set({ quantity: target[0].quantity + source.quantity })
          .where(
            and(
              eq(deckCards.deckId, id),
              eq(deckCards.printingId, printingId),
              eq(deckCards.category, toCategory),
            ),
          );
        await tx
          .delete(deckCards)
          .where(
            and(
              eq(deckCards.deckId, id),
              eq(deckCards.printingId, printingId),
              eq(deckCards.category, fromCategory),
            ),
          );
      } else {
        await tx
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
      await tx
        .update(decks)
        .set({ updatedAt: sql`now()` })
        .where(eq(decks.id, id));
      return { notFound: false as const };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("api/decks/id/cards", err, "Couldn't update deck cards.");
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

    // Banned-card warning — surfaced in the response so the client can show a
    // toast. Only matters when the operation is an add (delta > 0 or set > 0).
    let bannedWarning: string | null = null;
    const isAdding =
      (set != null && set > 0) || (delta != null && delta > 0);
    if (isAdding) {
      const legality = await db
        .select({
          isCommanderLegal: cards.isCommanderLegal,
          name: cards.name,
        })
        .from(printings)
        .innerJoin(cards, eq(cards.oracleId, printings.oracleId))
        .where(eq(printings.id, printingId))
        .limit(1);
      const lookup = legality[0];
      if (lookup && lookup.isCommanderLegal === false) {
        bannedWarning = `${lookup.name} is banned in Commander.`;
      }
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
      return NextResponse.json({ row: null, deleted: true, bannedWarning });
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
      return NextResponse.json({ row: updated, bannedWarning });
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
    return NextResponse.json(
      { row: inserted, bannedWarning },
      { status: 201 },
    );
  } catch (err) {
    return serverError("api/decks/id/cards", err, "Couldn't update deck cards.");
  }
}
