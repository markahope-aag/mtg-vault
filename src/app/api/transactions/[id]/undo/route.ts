import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { inventory, transactions } from "@/db/schema";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * Undo a transaction — the ledger equivalent of "Undo this import
 * batch". Reverses the inventory side-effects the transaction caused:
 *
 *   - 'in' lines: hard-DELETE the inventory rows that were created
 *     when the transaction was logged.
 *   - 'out' lines: clear disposedAt / disposedTo / disposedPrice /
 *     transactionId on the rows, restoring them to active state.
 *   - The transaction row itself is deleted (cascades transaction_lines).
 *
 * Safety rule: refuses if any 'in' inventory row has been touched
 * downstream — disposed by a later transaction (sale, trade away),
 * or re-tagged with a different transactionId. The check is per-row:
 *   inventory.disposedAt IS NULL          AND
 *   inventory.transactionId = thisTxnId
 * If even one row fails, 409 with the conflicting card name so the
 * user can deal with the chain explicitly (undo the later sale first,
 * then this one).
 *
 * User edits to a row's location / condition / notes are NOT a block —
 * those edits are lost when we delete the row, which the confirm-toast
 * description warns about. The block is reserved for state changes
 * that another transaction depends on.
 *
 * The whole thing runs in a single db.transaction. Partial failure
 * (network blip mid-way, FK violation surprise) rolls everything
 * back — no half-undo states.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load the transaction.
      const txnRows = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.id, id))
        .limit(1);
      const txn = txnRows[0];
      if (!txn) return { kind: "not_found" as const };

      // 2. Load the lines, joined with inventory so we can check the
      //    safety condition + know what to delete/restore.
      const lines = (await tx.execute(sql`
        SELECT
          tl.id           AS line_id,
          tl.direction    AS direction,
          tl.inventory_id AS inventory_id,
          i.disposed_at   AS disposed_at,
          i.transaction_id AS row_txn_id,
          c.name          AS card_name
        FROM transaction_lines tl
        LEFT JOIN inventory i ON i.id = tl.inventory_id
        LEFT JOIN printings p ON p.id = tl.printing_id
        LEFT JOIN cards c     ON c.oracle_id = p.oracle_id
        WHERE tl.transaction_id = ${id}
      `)) as unknown as Array<{
        line_id: string;
        direction: "in" | "out";
        inventory_id: string | null;
        disposed_at: Date | null;
        row_txn_id: string | null;
        card_name: string | null;
      }>;

      // 3. Safety check: every 'in' line's inventory row must still
      //    be tagged to THIS transaction AND not disposed.
      const conflicts: string[] = [];
      for (const line of lines) {
        if (line.direction !== "in") continue;
        if (line.inventory_id == null) continue; // row already gone
        if (line.disposed_at != null) {
          conflicts.push(
            `"${line.card_name ?? line.inventory_id}" was disposed by a later transaction`,
          );
          continue;
        }
        if (line.row_txn_id !== id) {
          conflicts.push(
            `"${line.card_name ?? line.inventory_id}" has been re-tagged by another transaction`,
          );
        }
      }
      if (conflicts.length > 0) {
        return {
          kind: "conflict" as const,
          conflicts,
        };
      }

      // 4. Hard-delete inventory rows from 'in' lines.
      const inInventoryIds = lines
        .filter((l) => l.direction === "in" && l.inventory_id != null)
        .map((l) => l.inventory_id as string);
      let deleted = 0;
      if (inInventoryIds.length > 0) {
        const deletedRows = await tx
          .delete(inventory)
          .where(
            and(
              inArray(inventory.id, inInventoryIds),
              // Defensive: only delete if still tagged to THIS txn
              // AND still active. The safety check above already
              // confirmed this, but the WHERE makes the SQL itself
              // safe under any race.
              eq(inventory.transactionId, id),
              isNull(inventory.disposedAt),
            ),
          )
          .returning({ id: inventory.id });
        deleted = deletedRows.length;
      }

      // 5. Restore inventory rows from 'out' lines.
      const outInventoryIds = lines
        .filter((l) => l.direction === "out" && l.inventory_id != null)
        .map((l) => l.inventory_id as string);
      let restored = 0;
      if (outInventoryIds.length > 0) {
        const restoredRows = await tx
          .update(inventory)
          .set({
            disposedAt: null,
            disposedTo: null,
            disposedPrice: null,
            transactionId: null,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              inArray(inventory.id, outInventoryIds),
              // Defensive: only clear OUR disposal, not someone else's.
              eq(inventory.transactionId, id),
            ),
          )
          .returning({ id: inventory.id });
        restored = restoredRows.length;
      }

      // 6. Delete the transaction (cascades transaction_lines).
      await tx.delete(transactions).where(eq(transactions.id, id));

      return { kind: "ok" as const, deleted, restored };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }
    if (result.kind === "conflict") {
      return NextResponse.json(
        {
          error:
            "Can't undo — this transaction has downstream effects in another transaction. Undo the later one first.",
          conflicts: result.conflicts,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      deleted: result.deleted,
      restored: result.restored,
    });
  } catch (err) {
    return serverError(
      "api/transactions/id/undo",
      err,
      "Couldn't undo that transaction.",
    );
  }
}
