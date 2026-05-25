import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { fetchLedgerSummary } from "@/lib/ledger/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  kind: "purchase" | "sale" | "trade";
  occurredAt: string;
  counterparty: string | null;
  channel: string | null;
  cashInUsd: number;
  cashOutUsd: number;
  feesUsd: number;
  inCount: number;
  outCount: number;
  inValue: number;
  outValue: number;
  notes: string | null;
};

async function fetchLedger(): Promise<LedgerRow[]> {
  const rows = (await db.execute(sql`
    SELECT
      t.id, t.kind, t.occurred_at, t.counterparty, t.channel, t.notes,
      t.cash_in_usd, t.cash_out_usd, t.fees_usd,
      COALESCE(s.in_count, 0)::int AS in_count,
      COALESCE(s.out_count, 0)::int AS out_count,
      COALESCE(s.in_value, 0)::numeric(12, 2) AS in_value,
      COALESCE(s.out_value, 0)::numeric(12, 2) AS out_value
    FROM transactions t
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE direction = 'in')::int AS in_count,
        COUNT(*) FILTER (WHERE direction = 'out')::int AS out_count,
        COALESCE(SUM(allocated_value_usd::numeric) FILTER (WHERE direction = 'in'), 0) AS in_value,
        COALESCE(SUM(allocated_value_usd::numeric) FILTER (WHERE direction = 'out'), 0) AS out_value
      FROM transaction_lines
      WHERE transaction_id = t.id
    ) s ON TRUE
    ORDER BY t.occurred_at DESC, t.created_at DESC
    LIMIT 500
  `)) as unknown as Array<{
    id: string;
    kind: string;
    occurred_at: string;
    counterparty: string | null;
    channel: string | null;
    notes: string | null;
    cash_in_usd: string | null;
    cash_out_usd: string | null;
    fees_usd: string | null;
    in_count: number;
    out_count: number;
    in_value: string;
    out_value: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as LedgerRow["kind"],
    occurredAt: new Date(r.occurred_at).toISOString(),
    counterparty: r.counterparty,
    channel: r.channel,
    cashInUsd: r.cash_in_usd ? Number.parseFloat(r.cash_in_usd) : 0,
    cashOutUsd: r.cash_out_usd ? Number.parseFloat(r.cash_out_usd) : 0,
    feesUsd: r.fees_usd ? Number.parseFloat(r.fees_usd) : 0,
    inCount: r.in_count,
    outCount: r.out_count,
    inValue: Number.parseFloat(r.in_value) || 0,
    outValue: Number.parseFloat(r.out_value) || 0,
    notes: r.notes,
  }));
}

const KIND_TONE: Record<LedgerRow["kind"], string> = {
  purchase:
    "border-[var(--value-negative)]/40 bg-[var(--value-negative)]/10 text-[var(--value-negative)]",
  sale: "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10 text-[var(--value-positive)]",
  trade: "border-amber-500/40 bg-amber-500/10 text-amber-500",
};

const KIND_LABEL: Record<LedgerRow["kind"], string> = {
  purchase: "Purchase",
  sale: "Sale",
  trade: "Trade",
};

export default async function TradesPage() {
  const [rows, summary] = await Promise.all([
    fetchLedger(),
    fetchLedgerSummary(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Trades &amp; Ledger
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Every purchase, sale, and trade — chronological. Cost basis is
            allocated automatically by market value; realized P&amp;L follows
            inventory through dispositions.
          </p>
        </div>
        <Link
          href="/trades/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 text-sm font-medium text-[var(--brand-foreground)] transition-colors hover:bg-[var(--brand)]/90"
        >
          <Plus className="size-4" /> Log transaction
        </Link>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-text-muted">
            No transactions logged yet. Click <strong>Log transaction</strong>{" "}
            above to record a purchase, sale, or trade.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {rows.map((r) => {
                  const net =
                    r.kind === "sale"
                      ? r.cashInUsd - r.feesUsd - r.outValue
                      : r.kind === "purchase"
                        ? -(r.cashOutUsd + r.feesUsd)
                        : r.cashInUsd -
                          r.cashOutUsd -
                          r.feesUsd +
                          r.inValue -
                          r.outValue;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/trades/${r.id}`}
                        className="block px-4 py-3 transition-colors hover:bg-surface-inset/40"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
                                  KIND_TONE[r.kind],
                                )}
                              >
                                {KIND_LABEL[r.kind]}
                              </span>
                              <span className="font-medium">
                                {r.counterparty ?? "(no counterparty)"}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {new Date(r.occurredAt).toLocaleDateString()}
                              {r.channel && (
                                <>
                                  {" · "}
                                  <span className="font-mono uppercase">
                                    {r.channel}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs tabular-nums">
                            {r.outCount > 0 && (
                              <span className="font-mono uppercase tracking-wide text-[var(--value-negative)]">
                                ↓ {r.outCount} (${r.outValue.toFixed(2)})
                              </span>
                            )}
                            {r.inCount > 0 && (
                              <span className="font-mono uppercase tracking-wide text-[var(--value-positive)]">
                                ↑ {r.inCount} (${r.inValue.toFixed(2)})
                              </span>
                            )}
                            <span
                              className={`font-mono text-[11px] font-semibold ${net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
                            >
                              {net >= 0 ? "+" : ""}${net.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {r.notes && (
                          <p className="mt-1 truncate text-xs text-text-muted">
                            {r.notes}
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Lifetime realized
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Transactions</span>
                  <span className="tabular-nums">
                    {summary.lifetime.transactionCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">
                    Purchases / sales / trades
                  </span>
                  <span className="font-mono tabular-nums">
                    {summary.lifetime.purchaseCount} /{" "}
                    {summary.lifetime.saleCount} /{" "}
                    {summary.lifetime.tradeCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Proceeds</span>
                  <span className="tabular-nums text-[var(--value-positive)]">
                    ${summary.lifetime.proceedsUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Basis</span>
                  <span className="tabular-nums text-[var(--value-negative)]">
                    ${summary.lifetime.basisUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-subtle pt-1.5">
                  <span className="font-medium">Realized</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      summary.lifetime.realizedUsd >= 0
                        ? "text-[var(--value-positive)]"
                        : "text-[var(--value-negative)]"
                    }`}
                  >
                    {summary.lifetime.realizedUsd >= 0 ? "+" : ""}$
                    {summary.lifetime.realizedUsd.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {summary.byYear.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    By year
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  {summary.byYear.map((y) => (
                    <div
                      key={y.year}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span>
                        {y.year}{" "}
                        <span className="font-mono text-[10px] text-text-muted">
                          {y.transactionCount} txn
                        </span>
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          y.realizedUsd >= 0
                            ? "text-[var(--value-positive)]"
                            : "text-[var(--value-negative)]"
                        }`}
                      >
                        {y.realizedUsd >= 0 ? "+" : ""}$
                        {y.realizedUsd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {summary.byCounterparty.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    Counterparties
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {summary.byCounterparty.slice(0, 10).map((p) => (
                    <div
                      key={p.counterparty}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.counterparty}</p>
                        <p className="text-[10px] text-text-muted">
                          {p.transactionCount} txn
                        </p>
                      </div>
                      <span
                        className={`font-mono tabular-nums ${
                          p.realizedUsd >= 0
                            ? "text-[var(--value-positive)]"
                            : "text-[var(--value-negative)]"
                        }`}
                      >
                        {p.realizedUsd >= 0 ? "+" : ""}$
                        {p.realizedUsd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
