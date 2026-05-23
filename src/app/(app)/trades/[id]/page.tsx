import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { realizedPnL } from "@/lib/ledger/allocate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  trade: "Trade",
};

type LineRow = {
  id: string;
  direction: "in" | "out";
  oracleId: string;
  cardName: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUri: string | null;
  foil: boolean;
  etched: boolean;
  condition: string | null;
  allocatedValueUsd: number;
  marketValueAtTimeUsd: number | null;
  /** Inventory.acquired_price — what we paid for the card on the row this
   *  line points to. For 'out' lines this is the cost basis we're
   *  disposing; for 'in' it's just what we just set (= allocatedValueUsd). */
  inventoryBasisUsd: number;
  /** Current market value (printings.usd). Lets the "trade fairness retro"
   *  section show drift since the transaction. */
  currentMarketUsd: number | null;
};

async function fetchTransactionDetail(id: string) {
  const txnRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  const txn = txnRows[0];
  if (!txn) return null;

  const linesRows = (await db.execute(sql`
    SELECT
      tl.id, tl.direction, tl.printing_id,
      tl.allocated_value_usd, tl.market_value_at_time_usd,
      c.oracle_id, c.name AS card_name,
      p.set_code, p.set_name, p.collector_number,
      COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
      i.foil, i.etched, i.condition, i.acquired_price,
      CASE
        WHEN i.foil THEN COALESCE(p.usd_foil::numeric, p.usd::numeric)
        ELSE p.usd::numeric
      END AS current_market
    FROM transaction_lines tl
    JOIN printings p ON p.id = tl.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    LEFT JOIN inventory i ON i.id = tl.inventory_id
    WHERE tl.transaction_id = ${id}
    ORDER BY tl.direction ASC, c.name ASC
  `)) as unknown as Array<{
    id: string;
    direction: "in" | "out";
    printing_id: string;
    allocated_value_usd: string | null;
    market_value_at_time_usd: string | null;
    oracle_id: string;
    card_name: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_uri: string | null;
    foil: boolean | null;
    etched: boolean | null;
    condition: string | null;
    acquired_price: string | null;
    current_market: string | null;
  }>;

  const lines: LineRow[] = linesRows.map((r) => ({
    id: r.id,
    direction: r.direction,
    oracleId: r.oracle_id,
    cardName: r.card_name,
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
    inventoryBasisUsd: r.acquired_price
      ? Number.parseFloat(r.acquired_price)
      : 0,
    currentMarketUsd: r.current_market
      ? Number.parseFloat(r.current_market)
      : null,
  }));

  const cashIn = txn.cashInUsd ? Number.parseFloat(txn.cashInUsd) : 0;
  const cashOut = txn.cashOutUsd ? Number.parseFloat(txn.cashOutUsd) : 0;
  const fees = txn.feesUsd ? Number.parseFloat(txn.feesUsd) : 0;
  const pnl = realizedPnL({
    kind: txn.kind as "purchase" | "sale" | "trade",
    cashInUsd: cashIn,
    cashOutUsd: cashOut,
    feesUsd: fees,
    lines: lines.map((l) => ({
      direction: l.direction,
      basisUsd:
        l.direction === "out" ? l.inventoryBasisUsd : l.allocatedValueUsd,
      allocatedValueUsd: l.allocatedValueUsd,
    })),
  });

  return { txn, lines, cashIn, cashOut, fees, pnl };
}

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchTransactionDetail(id);
  if (!detail) notFound();
  const { txn, lines, cashIn, cashOut, fees, pnl } = detail;

  const ins = lines.filter((l) => l.direction === "in");
  const outs = lines.filter((l) => l.direction === "out");

  // Trade fairness retro: per-line drift between market-at-time and
  // current market. Only meaningful for trades; we show it anyway since
  // it's cheap and the user might want it for sales / purchases too.
  const totalAtTime = lines.reduce(
    (s, l) => s + (l.marketValueAtTimeUsd ?? 0),
    0,
  );
  const totalNow = lines.reduce((s, l) => s + (l.currentMarketUsd ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/trades" label="Trades &amp; Purchases" />
      </div>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {KIND_LABEL[txn.kind] ?? txn.kind}
            <span className="font-mono text-text-muted"> · </span>
            {txn.counterparty ?? "(no counterparty)"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {new Date(txn.occurredAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {txn.channel && (
              <>
                {" · "}
                <span className="font-mono uppercase">{txn.channel}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {cashOut > 0 && (
            <span className="font-mono uppercase">
              <span className="text-text-muted">Cash out </span>
              <span className="tabular-nums text-[var(--value-negative)]">
                ${cashOut.toFixed(2)}
              </span>
            </span>
          )}
          {cashIn > 0 && (
            <span className="font-mono uppercase">
              <span className="text-text-muted">Cash in </span>
              <span className="tabular-nums text-[var(--value-positive)]">
                ${cashIn.toFixed(2)}
              </span>
            </span>
          )}
          {fees > 0 && (
            <span className="font-mono uppercase">
              <span className="text-text-muted">Fees </span>
              <span className="tabular-nums text-text-secondary">
                ${fees.toFixed(2)}
              </span>
            </span>
          )}
          {txn.kind !== "purchase" && (
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${pnl.realizedUsd >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
            >
              Realized {pnl.realizedUsd >= 0 ? "+" : ""}$
              {pnl.realizedUsd.toFixed(2)}
            </span>
          )}
        </div>
      </header>

      {txn.notes && (
        <Card className="mb-6">
          <CardContent className="p-4 text-sm">{txn.notes}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SideColumn title="Out (disposed)" items={outs} negative />
        <SideColumn title="In (acquired)" items={ins} />
      </div>

      {(totalAtTime > 0 || totalNow > 0) && lines.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Market drift since transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <p className="text-text-muted">
              Snapshot at transaction time vs. current printing prices. Only
              the cards on each side matter for retro fairness analysis.
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-4 font-mono uppercase">
              <span>
                <span className="text-text-muted">Then: </span>
                <span className="tabular-nums">${totalAtTime.toFixed(2)}</span>
              </span>
              <span>
                <span className="text-text-muted">Now: </span>
                <span className="tabular-nums">${totalNow.toFixed(2)}</span>
              </span>
              <span
                className={`text-sm font-semibold ${totalNow - totalAtTime >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
              >
                {totalNow - totalAtTime >= 0 ? "+" : ""}$
                {(totalNow - totalAtTime).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SideColumn({
  title,
  items,
  negative,
}: {
  title: string;
  items: LineRow[];
  negative?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.allocatedValueUsd, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            {title}{" "}
            <span className="font-normal text-text-muted">({items.length})</span>
          </span>
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              negative
                ? "text-[var(--value-negative)]"
                : "text-[var(--value-positive)]",
            )}
          >
            ${total.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Nothing on this side.
          </p>
        ) : (
          items.map((i) => (
            <Link
              key={i.id}
              href={`/cards/${i.oracleId}`}
              className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 hover:bg-surface-inset"
            >
              <ImgWithFallback
                src={i.imageUri}
                alt={i.cardName}
                className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                fallbackIconClassName="size-4"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">{i.cardName}</p>
                <p className="font-mono text-[10px] uppercase text-text-muted">
                  {i.setCode} · #{i.collectorNumber}
                  {i.condition && ` · ${i.condition}`}
                  {i.foil ? " · Foil" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs tabular-nums">
                  ${i.allocatedValueUsd.toFixed(2)}
                </p>
                {i.marketValueAtTimeUsd != null &&
                  Math.abs(i.marketValueAtTimeUsd - i.allocatedValueUsd) >
                    0.01 && (
                    <p className="font-mono text-[10px] text-text-muted">
                      mkt ${i.marketValueAtTimeUsd.toFixed(2)}
                    </p>
                  )}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
