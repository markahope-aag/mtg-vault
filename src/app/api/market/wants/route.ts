import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { wants } from "@/db/schema";
import { fetchWantList } from "@/lib/market/wantlist";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await fetchWantList();
    return NextResponse.json({ wants: list });
  } catch (err) {
    return serverError(
      "api/market/wants GET",
      err,
      "Couldn't load want list.",
    );
  }
}

const createSchema = z.object({
  oracleId: z.string().uuid(),
  targetQuantity: z.number().int().min(1).max(99).default(1),
  maxPriceUsd: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const [row] = await db
      .insert(wants)
      .values({
        oracleId: parsed.data.oracleId,
        targetQuantity: parsed.data.targetQuantity,
        maxPriceUsd:
          parsed.data.maxPriceUsd != null
            ? parsed.data.maxPriceUsd.toFixed(2)
            : null,
        notes: parsed.data.notes ?? null,
      })
      .returning({ id: wants.id });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    return serverError(
      "api/market/wants POST",
      err,
      "Couldn't add to want list.",
    );
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const parsed = deleteSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await db.delete(wants).where(eq(wants.id, parsed.data.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/market/wants DELETE",
      err,
      "Couldn't delete want.",
    );
  }
}
