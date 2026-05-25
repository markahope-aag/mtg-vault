import { and, eq, lt } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { patchProposalSchema } from "@/lib/rogue/schemas";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Stale-generation window. /api/proposals POST has maxDuration=300s
// (5 min) — anything still 'generating' past 6 min has either crashed
// the function mid-write (e.g. transient DB blip after a successful
// LLM call) or hit Vercel's hard timeout without the catch running.
// Either way, the proposal is stuck spinning in the Builder UI; the
// safe interpretation is "this failed silently" so the user can move
// on. Self-heal on read to avoid needing a separate cron.
const STALE_GENERATING_MS = 6 * 60_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Pre-flight: if this proposal is stuck at 'generating' past the
    // stale window, flip it to 'failed' before reading. The UPDATE
    // matches by id + status + createdAt cutoff so it's a no-op for
    // healthy proposals and races safely if two concurrent GETs both
    // attempt the heal.
    const cutoff = new Date(Date.now() - STALE_GENERATING_MS);
    await db
      .update(deckProposals)
      .set({
        status: "failed",
        generationLog: {
          error:
            "Generation timed out — the server stopped responding before the proposal finished.",
          at: new Date().toISOString(),
          stale: true,
        },
      })
      .where(
        and(
          eq(deckProposals.id, id),
          eq(deckProposals.status, "generating"),
          lt(deckProposals.createdAt, cutoff),
        ),
      );

    const rows = await db
      .select()
      .from(deckProposals)
      .where(eq(deckProposals.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ proposal: row });
  } catch (err) {
    return serverError(
      "api/proposals/id",
      err,
      "Couldn't load that proposal.",
    );
  }
}


// The proposal is a DRAFT — the user can edit before saving as a real deck.
// PATCH overwrites cardList (and optionally targetBracket / archetypeBrief)
// so the editable UI can persist changes server-side without re-running
// generation.
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
  const parsed = patchProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // Only set fields the user actually sent. Spreading parsed.data into
  // the update would write `undefined` for omitted fields, which
  // Drizzle interprets as "set this column to NULL" — wiping
  // cardList/archetypeBrief on a partial update.
  const update: Record<string, unknown> = {};
  if (parsed.data.cardList !== undefined)
    update.cardList = parsed.data.cardList;
  if (parsed.data.archetypeBrief !== undefined)
    update.archetypeBrief = parsed.data.archetypeBrief;
  if (parsed.data.targetBracket !== undefined)
    update.targetBracket = parsed.data.targetBracket;
  try {
    await db
      .update(deckProposals)
      .set(update)
      .where(eq(deckProposals.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/proposals/id PATCH",
      err,
      "Couldn't update that proposal.",
    );
  }
}

// Hard delete. Deck_proposals.saved_deck_id has ON DELETE SET NULL pointing
// at decks(id), but we don't go the other way: deleting a proposal NEVER
// touches the linked deck. The proposal is just an audit / draft record.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await db.delete(deckProposals).where(eq(deckProposals.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/proposals/id DELETE",
      err,
      "Couldn't delete that proposal.",
    );
  }
}
