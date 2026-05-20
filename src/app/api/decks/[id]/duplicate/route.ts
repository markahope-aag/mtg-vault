import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { decks } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sourceRows = await db
      .select()
      .from(decks)
      .where(eq(decks.id, id))
      .limit(1);
    const source = sourceRows[0];
    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [copy] = await db
      .insert(decks)
      .values({
        name: `${source.name} (copy)`,
        commanderPrintingId: source.commanderPrintingId,
        partnerPrintingId: source.partnerPrintingId,
        targetBracket: source.targetBracket,
        archetype: source.archetype,
        notes: source.notes,
        isPrimary: false,
      })
      .returning();

    // Copy deck_cards. Done with a single INSERT ... SELECT for atomicity.
    await db.execute(sql`
      INSERT INTO deck_cards (deck_id, printing_id, quantity, category)
      SELECT ${copy.id}::uuid, printing_id, quantity, category
      FROM deck_cards
      WHERE deck_id = ${id}::uuid
    `);

    return NextResponse.json({ deck: copy }, { status: 201 });
  } catch (err) {
    console.error("[api/decks duplicate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
