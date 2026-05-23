import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type TradeSummary = {
  id: string;
  partner: string;
  tradedAt: string;
  notes: string | null;
  outCount: number;
  outValue: number;
  inCount: number;
  inValue: number;
};

async function fetchTrades(): Promise<TradeSummary[]> {
  const rows = (await db.execute(sql`
    SELECT
      t.id, t.partner, t.traded_at, t.notes,
      COALESCE(out_summary.cnt, 0)::int AS out_count,
      COALESCE(out_summary.total, 0)::numeric(12,2) AS out_value,
      COALESCE(in_summary.cnt, 0)::int AS in_count,
      COALESCE(in_summary.total, 0)::numeric(12,2) AS in_value
    FROM trades t
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, COALESCE(SUM(disposed_price::numeric), 0) AS total
      FROM inventory i
      WHERE i.trade_id = t.id AND i.disposed_at IS NOT NULL
    ) out_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt, COALESCE(SUM(acquired_price::numeric), 0) AS total
      FROM inventory i
      WHERE i.trade_id = t.id AND i.disposed_at IS NULL
    ) in_summary ON TRUE
    ORDER BY t.traded_at DESC
    LIMIT 200
  `)) as unknown as Array<{
    id: string;
    partner: string;
    traded_at: string;
    notes: string | null;
    out_count: number;
    out_value: string;
    in_count: number;
    in_value: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    partner: r.partner,
    tradedAt: new Date(r.traded_at).toISOString(),
    notes: r.notes,
    outCount: r.out_count,
    outValue: Number.parseFloat(r.out_value) || 0,
    inCount: r.in_count,
    inValue: Number.parseFloat(r.in_value) || 0,
  }));
}

export default async function TradesPage() {
  const trades = await fetchTrades();
  const totalIn = trades.reduce((s, t) => s + t.inValue, 0);
  const totalOut = trades.reduce((s, t) => s + t.outValue, 0);
  const net = totalIn - totalOut;

  // Per-partner running tally so the user can see who they trade with most
  // and whether they're "up" or "down" with a given partner over time.
  const byPartner = new Map<
    string,
    { trades: number; inValue: number; outValue: number }
  >();
  for (const t of trades) {
    const cur = byPartner.get(t.partner) ?? {
      trades: 0,
      inValue: 0,
      outValue: 0,
    };
    cur.trades += 1;
    cur.inValue += t.inValue;
    cur.outValue += t.outValue;
    byPartner.set(t.partner, cur);
  }
  const partners = [...byPartner.entries()]
    .map(([partner, s]) => ({ partner, ...s, net: s.inValue - s.outValue }))
    .sort((a, b) => b.trades - a.trades);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="mt-1 text-sm text-text-muted">
            Log card-for-card trades. Outgoing cards are marked disposed;
            incoming cards land in your inventory.
          </p>
        </div>
        <Link
          href="/trades/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 text-sm font-medium text-[var(--brand-foreground)] transition-colors hover:bg-[var(--brand)]/90"
        >
          <Plus className="size-4" /> Log trade
        </Link>
      </header>

      {trades.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-text-muted">
            No trades logged yet. Click <strong>Log trade</strong> above to
            record one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {trades.map((t) => {
                  const net = t.inValue - t.outValue;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/trades/${t.id}`}
                        className="block px-4 py-3 transition-colors hover:bg-surface-inset/40"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.partner}</p>
                            <p className="text-[11px] text-text-muted">
                              {new Date(t.tradedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs tabular-nums">
                            <span className="font-mono uppercase tracking-wide text-[var(--value-negative)]">
                              ↓ {t.outCount} (${t.outValue.toFixed(2)})
                            </span>
                            <span className="font-mono uppercase tracking-wide text-[var(--value-positive)]">
                              ↑ {t.inCount} (${t.inValue.toFixed(2)})
                            </span>
                            <span
                              className={`font-mono text-[11px] font-semibold ${net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
                            >
                              {net >= 0 ? "+" : ""}${net.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {t.notes && (
                          <p className="mt-1 truncate text-xs text-text-muted">
                            {t.notes}
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
                  Lifetime
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Trades</span>
                  <span className="tabular-nums">{trades.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">In</span>
                  <span className="tabular-nums text-[var(--value-positive)]">
                    ${totalIn.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Out</span>
                  <span className="tabular-nums text-[var(--value-negative)]">
                    ${totalOut.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-subtle pt-1.5">
                  <span className="font-medium">Net</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
                  >
                    {net >= 0 ? "+" : ""}${net.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {partners.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    Partners
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {partners.map((p) => (
                    <div
                      key={p.partner}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.partner}</p>
                        <p className="text-[10px] text-text-muted">
                          {p.trades} trade{p.trades === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`font-mono tabular-nums ${p.net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
                      >
                        {p.net >= 0 ? "+" : ""}${p.net.toFixed(2)}
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
