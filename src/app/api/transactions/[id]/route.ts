import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { realizedPnL } from "@/lib/ledger/allocate";
import { updateTransactionSchema } from "@/lib/ledger/schemas";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// ─── GET detail ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const txnRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);
    const txn = txnRows[0];
    if (!txn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const linesRows = (await db.execute(sql`
      SELECT
        tl.id, tl.direction, tl.inventory_id, tl.printing_id,
        tl.allocated_value_usd, tl.market_value_at_time_usd,
        c.oracle_id, c.name AS card_name, c.mana_cost,
        p.set_code, p.set_name, p.collector_number,
        COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
        i.foil, i.etched, i.condition, i.acquired_price
      FROM transaction_lines tl
      JOIN printings p ON p.id = tl.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      LEFT JOIN inventory i ON i.id = tl.inventory_id
      WHERE tl.transaction_id = ${id}
      ORDER BY tl.direction ASC, c.name ASC
    `)) as unknown as Array<{
      id: string;
      direction: "in" | "out";
      inventory_id: string | null;
      printing_id: string;
      allocated_value_usd: string | null;
      market_value_at_time_usd: string | null;
      oracle_id: string;
      card_name: string;
      mana_cost: string | null;
      set_code: string;
      set_name: string;
      collector_number: string;
      image_uri: string | null;
      foil: boolean | null;
      etched: boolean | null;
      condition: string | null;
      acquired_price: string | null;
    }>;

    const lines = linesRows.map((r) => ({
      id: r.id,
      direction: r.direction,
      inventoryId: r.inventory_id,
      printingId: r.printing_id,
      oracleId: r.oracle_id,
      name: r.card_name,
      manaCost: r.mana_cost,
      setCode: r.set_code,
      setName: r.set_name,
      collectorNumber: r.collector_number,
      imageUri: r.image_uri,
      foil: !!r.foil,
      etched: !!r.etched,
      condition: r.condition,
      allocatedValueUsd: r.allocated_value_usd
        ? Number.parseFloat(r.allocated_value_usd)
        : 0,
      marketValueAtTimeUsd: r.market_value_at_time_usd
        ? Number.parseFloat(r.market_value_at_time_usd)
        : null,
      /** Cost-basis on the inventory row this line points to. For 'out'
       *  lines, that's what we paid when we acquired the card; for 'in'
       *  lines, this is the basis we just set (= allocatedValueUsd). */
      inventoryBasisUsd: r.acquired_price
        ? Number.parseFloat(r.acquired_price)
        : 0,
    }));

    const cashIn = txn.cashInUsd ? Number.parseFloat(txn.cashInUsd) : 0;
    const cashOut = txn.cashOutUsd ? Number.parseFloat(txn.cashOutUsd) : 0;
    const fees = txn.feesUsd ? Number.parseFloat(txn.feesUsd) : 0;

    // Realized P&L uses inventory.acquired_price for 'out' lines (the
    // basis we PAID, not the market value at time of disposal).
    const pnl = realizedPnL({
      kind: txn.kind as "purchase" | "sale" | "trade",
      cashInUsd: cashIn,
      cashOutUsd: cashOut,
      feesUsd: fees,
      lines: lines.map((l) => ({
        direction: l.direction,
        basisUsd: l.direction === "out" ? l.inventoryBasisUsd : l.allocatedValueUsd,
        allocatedValueUsd: l.allocatedValueUsd,
      })),
    });

    return NextResponse.json({
      transaction: {
        id: txn.id,
        kind: txn.kind,
        occurredAt: txn.occurredAt.toISOString(),
        counterparty: txn.counterparty,
        channel: txn.channel,
        cashOutUsd: cashOut,
        cashInUsd: cashIn,
        feesUsd: fees,
        notes: txn.notes,
        createdAt: txn.createdAt.toISOString(),
      },
      lines,
      pnl,
    });
  } catch (err) {
    return serverError(
      "api/transactions/id GET",
      err,
      "Couldn't load that transaction.",
    );
  }
}

// ─── PATCH header ──────────────────────────────────────────────

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
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const update: Record<string, unknown> = {};
  if ("counterparty" in parsed.data) update.counterparty = parsed.data.counterparty;
  if ("channel" in parsed.data) update.channel = parsed.data.channel;
  if ("cashOutUsd" in parsed.data)
    update.cashOutUsd =
      parsed.data.cashOutUsd != null ? parsed.data.cashOutUsd.toFixed(2) : null;
  if ("cashInUsd" in parsed.data)
    update.cashInUsd =
      parsed.data.cashInUsd != null ? parsed.data.cashInUsd.toFixed(2) : null;
  if ("feesUsd" in parsed.data)
    update.feesUsd =
      parsed.data.feesUsd != null ? parsed.data.feesUsd.toFixed(2) : null;
  if ("notes" in parsed.data) update.notes = parsed.data.notes;
  if (parsed.data.occurredAt)
    update.occurredAt = new Date(parsed.data.occurredAt);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    // .returning() so we can tell the user when their id didn't match
    // any row. Without this the PATCH would 200 + {ok:true} even when
    // zero rows were updated — a silent no-op for a missing or stale
    // id is a worse UX than a 404 the client can react to.
    const updated = await db
      .update(transactions)
      .set(update)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });
    if (updated.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/transactions/id PATCH",
      err,
      "Couldn't update that transaction.",
    );
  }
}

// ─── DELETE ────────────────────────────────────────────────────

// Cascade deletes transaction_lines (ON DELETE CASCADE on the FK). The
// inventory rows live on — inventory.transaction_id is set to NULL via
// the FK. We intentionally don't un-dispose 'out' inventory or hard-
// delete 'in' inventory; the user can do that explicitly if they want
// to fully reverse a recorded event. Matches the existing /trades
// delete semantics.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Same .returning() trick as PATCH — a DELETE that matched zero
    // rows should 404, not silently succeed.
    const deleted = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/transactions/id DELETE",
      err,
      "Couldn't delete that transaction.",
    );
  }
}
