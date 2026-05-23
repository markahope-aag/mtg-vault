import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { inventory } from "@/db/schema";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const updated = await db
      .update(inventory)
      .set({
        disposedTo: null,
        disposedPrice: null,
        disposedAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(inventory.id, id))
      .returning();
    if (updated.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row: updated[0] });
  } catch (err) {
    return serverError("api/inventory/id/restore", err, "Couldn't restore that card.");
  }
}
