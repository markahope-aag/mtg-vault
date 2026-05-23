import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trades } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

type Item = {
  inventoryId: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUri: string | null;
  foil: boolean;
  etched: boolean;
  condition: string;
  value: number;
};

async function fetchTradeDetail(id: string) {
  const tradeRows = await db
    .select()
    .from(trades)
    .where(eq(trades.id, id))
    .limit(1);
  const trade = tradeRows[0];
  if (!trade) return null;

  const items = (await db.execute(sql`
    SELECT
      i.id, i.foil, i.etched, i.condition,
      i.disposed_at, i.disposed_price,
      i.acquired_price,
      c.oracle_id, c.name,
      p.set_code, p.set_name, p.collector_number,
      COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE i.trade_id = ${id}
    ORDER BY (i.disposed_at IS NOT NULL) DESC, c.name ASC
  `)) as unknown as Array<{
    id: string;
    foil: boolean;
    etched: boolean;
    condition: string;
    disposed_at: string | null;
    disposed_price: string | null;
    acquired_price: string | null;
    oracle_id: string;
    name: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_uri: string | null;
  }>;

  const toItem = (r: (typeof items)[number], priceField: "disposed_price" | "acquired_price"): Item => ({
    inventoryId: r.id,
    oracleId: r.oracle_id,
    name: r.name,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    imageUri: r.image_uri,
    foil: r.foil,
    etched: r.etched,
    condition: r.condition,
    value:
      r[priceField] != null
        ? Number.parseFloat(r[priceField] as string)
        : 0,
  });

  return {
    trade,
    out: items.filter((i) => i.disposed_at != null).map((i) => toItem(i, "disposed_price")),
    in: items.filter((i) => i.disposed_at == null).map((i) => toItem(i, "acquired_price")),
  };
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchTradeDetail(id);
  if (!detail) notFound();

  const outTotal = detail.out.reduce((s, i) => s + i.value, 0);
  const inTotal = detail.in.reduce((s, i) => s + i.value, 0);
  const net = inTotal - outTotal;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/trades" label="Trades" />
      </div>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {detail.trade.partner}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {new Date(detail.trade.tradedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-mono uppercase">
            <span className="text-text-muted">Out</span>{" "}
            <span className="tabular-nums text-[var(--value-negative)]">
              ${outTotal.toFixed(2)}
            </span>
          </span>
          <span className="font-mono uppercase">
            <span className="text-text-muted">In</span>{" "}
            <span className="tabular-nums text-[var(--value-positive)]">
              ${inTotal.toFixed(2)}
            </span>
          </span>
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
          >
            Net {net >= 0 ? "+" : ""}${net.toFixed(2)}
          </span>
        </div>
      </header>

      {detail.trade.notes && (
        <Card className="mb-6">
          <CardContent className="p-4 text-sm">{detail.trade.notes}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SideColumn title="Out" items={detail.out} negative />
        <SideColumn title="In" items={detail.in} />
      </div>
    </div>
  );
}

function SideColumn({
  title,
  items,
  negative,
}: {
  title: string;
  items: Item[];
  negative?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            {title}{" "}
            <span className="font-normal text-text-muted">({items.length})</span>
          </span>
          <span
            className={`font-mono text-xs tabular-nums ${negative ? "text-[var(--value-negative)]" : "text-[var(--value-positive)]"}`}
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
              key={i.inventoryId}
              href={`/cards/${i.oracleId}`}
              className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 hover:bg-surface-inset"
            >
              <ImgWithFallback
                src={i.imageUri}
                alt={i.name}
                className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                fallbackIconClassName="size-4"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">{i.name}</p>
                <p className="font-mono text-[10px] uppercase text-text-muted">
                  {i.setCode} · #{i.collectorNumber} · {i.condition}
                  {i.foil ? " · Foil" : ""}
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums">
                ${i.value.toFixed(2)}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
