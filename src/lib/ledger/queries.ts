import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { realizedPnL } from "./allocate";

/**
 * Lifetime + per-year realized P&L summary across every transaction.
 *
 * Loads every transaction + line in one query (the dataset is small for a
 * personal tool — even a heavy seller is hundreds of rows lifetime, not
 * millions). Runs the per-transaction realizedPnL() helper in-memory and
 * aggregates. Keeping the computation in TypeScript means the same exact
 * function powers the detail view + the summary, so they can never drift.
 */
export type LedgerSummary = {
  lifetime: {
    realizedUsd: number;
    proceedsUsd: number;
    basisUsd: number;
    transactionCount: number;
    purchaseCount: number;
    saleCount: number;
    tradeCount: number;
  };
  byYear: Array<{ year: number; realizedUsd: number; transactionCount: number }>;
  byCounterparty: Array<{
    counterparty: string;
    transactionCount: number;
    realizedUsd: number;
  }>;
};

type RawTxn = {
  id: string;
  kind: "purchase" | "sale" | "trade";
  occurredAt: Date;
  counterparty: string | null;
  cashInUsd: number;
  cashOutUsd: number;
  feesUsd: number;
  lines: Array<{
    direction: "in" | "out";
    allocatedValueUsd: number;
    inventoryBasisUsd: number;
  }>;
};

export async function fetchLedgerSummary(): Promise<LedgerSummary> {
  const txnRows = (await db.execute(sql`
    SELECT
      t.id, t.kind, t.occurred_at, t.counterparty,
      t.cash_in_usd, t.cash_out_usd, t.fees_usd
    FROM transactions t
    ORDER BY t.occurred_at ASC
  `)) as unknown as Array<{
    id: string;
    kind: string;
    occurred_at: string;
    counterparty: string | null;
    cash_in_usd: string | null;
    cash_out_usd: string | null;
    fees_usd: string | null;
  }>;
  const lineRows = (await db.execute(sql`
    SELECT
      tl.transaction_id, tl.direction, tl.allocated_value_usd,
      i.acquired_price
    FROM transaction_lines tl
    LEFT JOIN inventory i ON i.id = tl.inventory_id
  `)) as unknown as Array<{
    transaction_id: string;
    direction: "in" | "out";
    allocated_value_usd: string | null;
    acquired_price: string | null;
  }>;

  const linesByTxn = new Map<string, RawTxn["lines"]>();
  for (const r of lineRows) {
    const entry = linesByTxn.get(r.transaction_id) ?? [];
    entry.push({
      direction: r.direction,
      allocatedValueUsd: r.allocated_value_usd
        ? Number.parseFloat(r.allocated_value_usd)
        : 0,
      inventoryBasisUsd: r.acquired_price
        ? Number.parseFloat(r.acquired_price)
        : 0,
    });
    linesByTxn.set(r.transaction_id, entry);
  }

  const txns: RawTxn[] = txnRows.map((r) => ({
    id: r.id,
    kind: r.kind as "purchase" | "sale" | "trade",
    occurredAt: new Date(r.occurred_at),
    counterparty: r.counterparty,
    cashInUsd: r.cash_in_usd ? Number.parseFloat(r.cash_in_usd) : 0,
    cashOutUsd: r.cash_out_usd ? Number.parseFloat(r.cash_out_usd) : 0,
    feesUsd: r.fees_usd ? Number.parseFloat(r.fees_usd) : 0,
    lines: linesByTxn.get(r.id) ?? [],
  }));

  let realizedTotal = 0;
  let proceedsTotal = 0;
  let basisTotal = 0;
  const yearMap = new Map<
    number,
    { realizedUsd: number; transactionCount: number }
  >();
  const partnerMap = new Map<
    string,
    { transactionCount: number; realizedUsd: number }
  >();
  let purchaseCount = 0;
  let saleCount = 0;
  let tradeCount = 0;

  for (const t of txns) {
    const pnl = realizedPnL({
      kind: t.kind,
      cashInUsd: t.cashInUsd,
      cashOutUsd: t.cashOutUsd,
      feesUsd: t.feesUsd,
      lines: t.lines.map((l) => ({
        direction: l.direction,
        basisUsd:
          l.direction === "out" ? l.inventoryBasisUsd : l.allocatedValueUsd,
        allocatedValueUsd: l.allocatedValueUsd,
      })),
    });
    realizedTotal += pnl.realizedUsd;
    proceedsTotal += pnl.proceedsUsd;
    basisTotal += pnl.basisUsd;
    if (t.kind === "purchase") purchaseCount += 1;
    else if (t.kind === "sale") saleCount += 1;
    else tradeCount += 1;

    const year = t.occurredAt.getUTCFullYear();
    const yEntry = yearMap.get(year) ?? {
      realizedUsd: 0,
      transactionCount: 0,
    };
    yEntry.realizedUsd += pnl.realizedUsd;
    yEntry.transactionCount += 1;
    yearMap.set(year, yEntry);

    if (t.counterparty) {
      const pEntry = partnerMap.get(t.counterparty) ?? {
        transactionCount: 0,
        realizedUsd: 0,
      };
      pEntry.transactionCount += 1;
      pEntry.realizedUsd += pnl.realizedUsd;
      partnerMap.set(t.counterparty, pEntry);
    }
  }

  return {
    lifetime: {
      realizedUsd: round2(realizedTotal),
      proceedsUsd: round2(proceedsTotal),
      basisUsd: round2(basisTotal),
      transactionCount: txns.length,
      purchaseCount,
      saleCount,
      tradeCount,
    },
    byYear: [...yearMap.entries()]
      .map(([year, v]) => ({
        year,
        realizedUsd: round2(v.realizedUsd),
        transactionCount: v.transactionCount,
      }))
      .sort((a, b) => b.year - a.year),
    byCounterparty: [...partnerMap.entries()]
      .map(([counterparty, v]) => ({
        counterparty,
        transactionCount: v.transactionCount,
        realizedUsd: round2(v.realizedUsd),
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
