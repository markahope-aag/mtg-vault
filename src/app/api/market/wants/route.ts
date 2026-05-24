import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { wants } from "@/db/schema";
import { fetchWantList } from "@/lib/market/wantlist";
import {
  createWantSchema,
  deleteWantSchema,
} from "@/lib/market/schemas";
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createWantSchema.safeParse(body);
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

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const parsed = deleteWantSchema.safeParse({ id });
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
