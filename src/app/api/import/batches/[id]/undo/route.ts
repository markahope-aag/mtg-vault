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
    // Wrap the whole undo in a transaction. Without this, a mid-flight
    // failure could leave the batch's inserted rows deleted but the
    // replace_location disposes still in place, or the disposed rows
    // restored but the batch row still present — both are inconsistent
    // states the user can't easily clean up. The whole sequence is now
    // atomic; if anything throws, none of it commits.
    const result = await db.transaction(async (tx) => {
      const batchRows = await tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, id))
        .limit(1);
      const batch = batchRows[0];
      if (!batch) return null;

      // 1) Delete the rows this batch inserted.
      const deleted = await tx
        .delete(inventory)
        .where(eq(inventory.importBatchId, batch.id))
        .returning({ id: inventory.id });

      // 2) For replace_location batches, restore the rows we disposed.
      let restored = 0;
      if (batch.mode === "replace_location") {
        const restoredRows = await tx
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
        restored = restoredRows.length;
      }

      // 3) Delete the batch row itself.
      await tx.delete(importBatches).where(eq(importBatches.id, batch.id));

      return { deleted: deleted.length, restored };
    });

    if (result === null) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      deleted: result.deleted,
      restored: result.restored,
    });
  } catch (err) {
    return serverError("api/import/batches/id/undo", err, "Couldn't undo that import.");
  }
}
