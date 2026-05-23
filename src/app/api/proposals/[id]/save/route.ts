import { eq, sql, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { deckCards, deckProposals, decks } from "@/db/schema";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

type ProposalCard = {
  oracleId: string;
  name: string;
  isLand?: boolean;
  role?: string;
  rationale?: string;
};

/**
 * Commits a generated proposal to a real decks + deck_cards record.
 *
 * - Picks the cheapest non-foil printing per oracle id (foil-only fallback
 *   for printings with no usd at all).
 * - Aggregates duplicates into deck_cards.quantity (basics keep their
 *   count; non-basics will already be unique post-validation).
 * - Sets the proposal's saved_deck_id + status = 'saved'.
 * - Wraps everything in a transaction so a partial commit can't strand a
 *   half-saved deck.
 */
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name: deckName } = parsed.data;

  try {
    const proposalRows = await db
      .select()
      .from(deckProposals)
      .where(eq(deckProposals.id, id))
      .limit(1);
    const proposal = proposalRows[0];
    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 },
      );
    }
    if (!proposal.cardList || !proposal.commanderOracleId) {
      return NextResponse.json(
        { error: "Proposal is empty or has no commander" },
        { status: 400 },
      );
    }
    if (proposal.savedDeckId) {
      return NextResponse.json(
        { error: "Proposal already saved", deckId: proposal.savedDeckId },
        { status: 409 },
      );
    }

    const cardList = proposal.cardList as ProposalCard[];
    const oracleIds = [...new Set(cardList.map((c) => c.oracleId))];

    // Cheapest printing per oracle id. Same logic as reconcile: prefer
    // non-foil usd, fall back to foil. DISTINCT ON ordered by computed
    // price asc with NULLs last so cards with no price still get a row.
    const printingRows = (await db.execute(sql`
      SELECT DISTINCT ON (oracle_id) oracle_id, id AS printing_id
      FROM printings
      WHERE oracle_id = ANY(ARRAY[${sql.join(
        oracleIds.map((o) => sql`${o}::uuid`),
        sql`, `,
      )}])
      ORDER BY
        oracle_id,
        (usd IS NULL) ASC,
        COALESCE(usd::numeric, usd_foil::numeric) ASC NULLS LAST,
        released_at DESC NULLS LAST
    `)) as unknown as Array<{ oracle_id: string; printing_id: string }>;
    const printingByOracle = new Map(
      printingRows.map((r) => [r.oracle_id, r.printing_id]),
    );

    // Commander printing has to be a printing of the commander's oracle id.
    const commanderPrintingId = printingByOracle.get(
      proposal.commanderOracleId,
    );
    if (!commanderPrintingId) {
      return NextResponse.json(
        { error: "No printing found for the commander oracle id" },
        { status: 500 },
      );
    }

    // Aggregate cardList → deck_cards rows. Each cardList row is one
    // physical card slot; collapse repeats (basics) into quantity.
    type DeckCardRow = {
      printingId: string;
      quantity: number;
      category: string;
    };
    const slots = new Map<string, DeckCardRow>();
    for (const c of cardList) {
      // Skip the commander itself; it lives on the deck row, not deck_cards.
      if (c.oracleId === proposal.commanderOracleId) continue;
      const pid = printingByOracle.get(c.oracleId);
      if (!pid) continue;
      const existing = slots.get(pid);
      if (existing) existing.quantity += 1;
      else
        slots.set(pid, {
          printingId: pid,
          quantity: 1,
          category: "main",
        });
    }

    const newDeckId = await db.transaction(async (tx) => {
      const [deck] = await tx
        .insert(decks)
        .values({
          name: deckName,
          commanderPrintingId,
          targetBracket: proposal.targetBracket,
          notes: proposal.archetypeBrief ?? null,
        })
        .returning({ id: decks.id });

      const slotValues = [...slots.values()].map((s) => ({
        deckId: deck.id,
        printingId: s.printingId,
        quantity: s.quantity,
        category: s.category,
      }));
      if (slotValues.length > 0) {
        await tx.insert(deckCards).values(slotValues);
      }

      await tx
        .update(deckProposals)
        .set({ status: "saved", savedDeckId: deck.id })
        .where(eq(deckProposals.id, id));

      return deck.id;
    });

    return NextResponse.json({ deckId: newDeckId }, { status: 201 });
  } catch (err) {
    return serverError(
      "api/proposals/id/save",
      err,
      "Couldn't save the proposal as a deck.",
    );
  }
}

// Silence lint on the inArray import we don't end up using here; kept for
// future "save multiple proposals at once" if we ever add it.
void inArray;
