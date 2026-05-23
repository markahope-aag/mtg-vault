import Link from "next/link";
import {
  appreciatedCards,
  topMovers,
  underwaterCards,
} from "@/lib/market/valuation";
import { marketSources } from "@/lib/market/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const [appreciated, movers, underwater] = await Promise.all([
    appreciatedCards({ minGainPct: 25, minGainUsd: 1, limit: 25 }),
    topMovers({ days: 7, limit: 15, direction: "either" }),
    underwaterCards({ minLossPct: 10, limit: 25 }),
  ]);

  // Source status — surfaced so the user knows whether the bargain
  // detector (Phase B3) has anything to query against.
  const sources = marketSources.all().map((s) => ({
    id: s.id,
    displayName: s.displayName,
    enabled: s.enabled,
    hasSoldData: s.hasSoldData,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="mt-1 text-sm text-text-muted">
          Valuation intelligence + bargain detection. The valuation views
          below run on your inventory and our price history — no external
          credentials required. Bargain detection needs an eBay developer
          app (see Sources panel).
        </p>
      </header>

      <SourcesPanel sources={sources} />

      <section className="mt-8 space-y-6">
        <AppreciatedSection rows={appreciated} />
        <MoversSection rows={movers} />
        <UnderwaterSection rows={underwater} />
      </section>
    </div>
  );
}

function SourcesPanel({
  sources,
}: {
  sources: Array<{
    id: string;
    displayName: string;
    enabled: boolean;
    hasSoldData: boolean;
  }>;
}) {
  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="px-4 py-3 text-xs text-text-muted">
          No market sources registered.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-3 text-xs">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-inset/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium">{s.displayName}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                {s.hasSoldData ? "Active + sold data" : "Active listings only"}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
                s.enabled
                  ? "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10 text-[var(--value-positive)]"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-500",
              )}
            >
              {s.enabled ? "Enabled" : "Configure to enable"}
            </span>
          </div>
        ))}
        {!sources.some((s) => s.enabled) && (
          <p className="px-1 pt-2 text-text-muted">
            No sources are enabled. The eBay adapter needs{" "}
            <code className="font-mono">EBAY_APP_ID</code>,{" "}
            <code className="font-mono">EBAY_CERT_ID</code>, and{" "}
            <code className="font-mono">EBAY_OAUTH_TOKEN</code> in{" "}
            <code className="font-mono">.env.local</code>. Register a free
            developer app at developer.ebay.com to obtain them.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AppreciatedSection({
  rows,
}: {
  rows: Awaited<ReturnType<typeof appreciatedCards>>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Appreciated cards{" "}
          <span className="ml-2 font-normal text-text-muted">
            ({rows.length})
          </span>
        </CardTitle>
        <p className="text-[11px] text-text-muted">
          Owned cards currently worth ≥25% / ≥$1 more than what you paid.
          Sell signals if you&rsquo;re willing to part with them.
        </p>
      </CardHeader>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Nothing meaningfully appreciated. Either your acquired prices
            are recent or nothing&rsquo;s moved past the threshold.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.inventoryId}>
                <Link
                  href={`/cards/${r.oracleId}`}
                  className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 hover:bg-surface-inset"
                >
                  <ImgWithFallback
                    src={r.imageUri}
                    alt={r.name}
                    className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                    fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                    fallbackIconClassName="size-4"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {r.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-text-muted">
                      {r.setCode} · {r.condition}
                      {r.foil ? " · Foil" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs tabular-nums">
                      ${r.acquiredPriceUsd.toFixed(2)} →{" "}
                      <span className="font-semibold">
                        ${r.currentMarketUsd.toFixed(2)}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-[var(--value-positive)]">
                      +${r.gainUsd.toFixed(2)} (+{r.gainPct.toFixed(0)}%)
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MoversSection({
  rows,
}: {
  rows: Awaited<ReturnType<typeof topMovers>>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Biggest movers this week{" "}
          <span className="ml-2 font-normal text-text-muted">
            ({rows.length})
          </span>
        </CardTitle>
        <p className="text-[11px] text-text-muted">
          Cards in your collection with the largest 7-day price delta.
          Needs at least a week of <code>price_history</code> snapshots —
          new accounts may show empty.
        </p>
      </CardHeader>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            No price-history movement to report yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.oracleId}>
                <Link
                  href={`/cards/${r.oracleId}`}
                  className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 hover:bg-surface-inset"
                >
                  <ImgWithFallback
                    src={r.imageUri}
                    alt={r.name}
                    className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                    fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                    fallbackIconClassName="size-4"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {r.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-text-muted">
                      {r.setCode}{" "}
                      {r.ownedCount > 1 && `· ×${r.ownedCount} owned`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs tabular-nums">
                      ${r.priceFromUsd.toFixed(2)} →{" "}
                      <span className="font-semibold">
                        ${r.priceToUsd.toFixed(2)}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        r.deltaUsd >= 0
                          ? "text-[var(--value-positive)]"
                          : "text-[var(--value-negative)]",
                      )}
                    >
                      {r.deltaUsd >= 0 ? "+" : ""}${r.deltaUsd.toFixed(2)} (
                      {r.deltaPct >= 0 ? "+" : ""}
                      {r.deltaPct.toFixed(1)}%)
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UnderwaterSection({
  rows,
}: {
  rows: Awaited<ReturnType<typeof underwaterCards>>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Underwater{" "}
          <span className="ml-2 font-normal text-text-muted">
            ({rows.length})
          </span>
        </CardTitle>
        <p className="text-[11px] text-text-muted">
          Owned cards where current market is &gt;10% below what you paid.
          Hold view — useful for cost-basis thinking, not panic.
        </p>
      </CardHeader>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Nothing meaningfully underwater.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.inventoryId}>
                <Link
                  href={`/cards/${r.oracleId}`}
                  className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 hover:bg-surface-inset"
                >
                  <ImgWithFallback
                    src={r.imageUri}
                    alt={r.name}
                    className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                    fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                    fallbackIconClassName="size-4"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {r.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-text-muted">
                      {r.setCode}
                      {r.foil ? " · Foil" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs tabular-nums">
                      ${r.acquiredPriceUsd.toFixed(2)} →{" "}
                      <span className="font-semibold">
                        ${r.currentMarketUsd.toFixed(2)}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-[var(--value-negative)]">
                      −${r.lossUsd.toFixed(2)} (−{r.lossPct.toFixed(0)}%)
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
