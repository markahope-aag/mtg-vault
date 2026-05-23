import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { inventory } from "@/db/schema";
import { disposeRowSchema } from "@/lib/inventory/schemas";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

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
  const parsed = disposeRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const disposedAt = parsed.data.disposedAt ?? new Date();
    const updated = await db
      .update(inventory)
      .set({
        disposedTo: parsed.data.disposedTo,
        disposedPrice: parsed.data.disposedPrice ?? null,
        disposedAt,
        notes: parsed.data.notes ?? undefined,
        updatedAt: sql`now()`,
      })
      .where(eq(inventory.id, id))
      .returning();
    if (updated.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row: updated[0] });
  } catch (err) {
    return serverError("api/inventory/id/dispose", err, "Couldn't dispose that card.");
  }
}
