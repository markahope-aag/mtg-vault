import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
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
  if (typeof body !== "object" || body == null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const b = body as {
    cardList?: unknown;
    archetypeBrief?: unknown;
    targetBracket?: unknown;
  };
  const update: Record<string, unknown> = {};
  if (Array.isArray(b.cardList)) update.cardList = b.cardList;
  if (typeof b.archetypeBrief === "string")
    update.archetypeBrief = b.archetypeBrief;
  if (b.targetBracket === null || typeof b.targetBracket === "number")
    update.targetBracket = b.targetBracket;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
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
