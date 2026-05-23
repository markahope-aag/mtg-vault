import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { importBatches, inventory } from "@/db/schema";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const batchRows = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, id))
      .limit(1);
    const batch = batchRows[0];
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // 1) Delete the rows this batch inserted.
    const deleted = await db
      .delete(inventory)
      .where(eq(inventory.importBatchId, batch.id))
      .returning({ id: inventory.id });

    // 2) For replace_location batches, restore the rows we disposed.
    let restored = 0;
    if (batch.mode === "replace_location") {
      const result = await db
        .update(inventory)
        .set({
          disposedAt: null,
          disposedTo: null,
          disposedPrice: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(inventory.disposedTo, `replaced by import batch ${batch.id}`)),
        )
        .returning({ id: inventory.id });
      restored = result.length;
    }

    // 3) Delete the batch row itself.
    await db.delete(importBatches).where(eq(importBatches.id, batch.id));

    return NextResponse.json({
      ok: true,
      deleted: deleted.length,
      restored,
    });
  } catch (err) {
    return serverError("api/import/batches/id/undo", err, "Couldn't undo that import.");
  }
}
