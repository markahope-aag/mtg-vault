import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { decks } from "@/db/schema";
import { updateDeckSchema } from "@/lib/decks/schemas";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { serverError } from "@/lib/api-errors";
import {
  validateCommanderPrinting,
  validatePartnerPrinting,
} from "@/lib/decks/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const detail = await fetchDeckDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    return serverError("api/decks/id", err, "Couldn't load that deck.");
  }
}

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
  const parsed = updateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.commanderPrintingId) {
    const check = await validateCommanderPrinting(data.commanderPrintingId);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 422 });
    }
    if (data.partnerPrintingId) {
      const pc = await validatePartnerPrinting(
        data.commanderPrintingId,
        data.partnerPrintingId,
      );
      if (!pc.ok) {
        return NextResponse.json({ error: pc.reason }, { status: 422 });
      }
    }
  }

  try {
    const updated = await db
      .update(decks)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(decks.id, id))
      .returning();
    if (updated.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ deck: updated[0] });
  } catch (err) {
    return serverError("api/decks/id", err, "Couldn't load that deck.");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const deleted = await db
      .delete(decks)
      .where(eq(decks.id, id))
      .returning({ id: decks.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("api/decks/id", err, "Couldn't load that deck.");
  }
}
