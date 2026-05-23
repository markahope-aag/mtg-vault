import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { decks, deckCards } from "@/db/schema";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

// Creates a new deck from a set of inventory-selected printings. Cards land
// on the main board; the user assigns a commander afterward in the builder.
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  cards: z
    .array(
      z.object({
        printingId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, cards } = parsed.data;

  // Dedupe defensively — deck_cards is keyed by (deck, printing, category).
  const byPrinting = new Map<string, number>();
  for (const c of cards) {
    byPrinting.set(c.printingId, Math.max(byPrinting.get(c.printingId) ?? 0, c.quantity));
  }

  try {
    const [deck] = await db
      .insert(decks)
      .values({ name })
      .returning({ id: decks.id, name: decks.name });

    const rows = [...byPrinting.entries()].map(([printingId, quantity]) => ({
      deckId: deck.id,
      printingId,
      quantity,
      category: "main",
    }));
    if (rows.length > 0) {
      await db.insert(deckCards).values(rows);
    }

    return NextResponse.json({ deck, added: rows.length }, { status: 201 });
  } catch (err) {
    return serverError("api/decks/from-selection", err, "Couldn't create deck from selection.");
  }
}
