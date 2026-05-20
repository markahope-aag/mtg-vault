import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { decks } from "@/db/schema";
import { createDeckSchema } from "@/lib/decks/schemas";
import { listDecks } from "@/lib/decks/queries";
import {
  validateCommanderPrinting,
  validatePartnerPrinting,
} from "@/lib/decks/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const sortRaw = params.get("sort");
  const sort = (
    ["name", "updatedAt", "createdAt"] as const
  ).includes(sortRaw as never)
    ? (sortRaw as "name" | "updatedAt" | "createdAt")
    : "updatedAt";
  const direction = params.get("dir") === "asc" ? "asc" : "desc";

  const archetype = params.get("filter[archetype]") ?? undefined;
  const isPrimaryRaw = params.get("filter[isPrimary]");
  const isPrimary =
    isPrimaryRaw === "true" ? true : isPrimaryRaw === "false" ? false : undefined;
  const colorIdRaw = params.get("filter[colorIdentity]");
  const colorIdentity = colorIdRaw
    ? colorIdRaw.split(",").filter(Boolean)
    : undefined;

  try {
    const rows = await listDecks({
      sort,
      direction,
      filters: { archetype, isPrimary, colorIdentity },
    });
    return NextResponse.json({ decks: rows });
  } catch (err) {
    console.error("[api/decks GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createDeckSchema.safeParse(body);
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
      return NextResponse.json(
        { error: check.reason },
        { status: 422 },
      );
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
    const [created] = await db
      .insert(decks)
      .values({
        name: data.name,
        commanderPrintingId: data.commanderPrintingId ?? null,
        partnerPrintingId: data.partnerPrintingId ?? null,
        targetBracket: data.targetBracket ?? null,
        archetype: data.archetype ?? null,
        notes: data.notes ?? null,
        isPrimary: data.isPrimary ?? false,
      })
      .returning();
    return NextResponse.json({ deck: created }, { status: 201 });
  } catch (err) {
    console.error("[api/decks POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
