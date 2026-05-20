import Link from "next/link";
import { ImageOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BracketBadge } from "@/components/bracket-badge";
import { ValueDelta } from "@/components/value-delta";
import { computeCollectionValue } from "@/db/queries/collection-value";
import {
  fetchSnapshots,
  fetchTopCardsByValue,
  fetchDeckSummaries,
  fetchInsights,
} from "@/lib/dashboard/queries";
import { ValueChart } from "@/components/dashboard/value-chart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COLOR_TOKEN: Record<string, string> = {
  W: "var(--color-mtg-white)",
  U: "var(--color-mtg-blue)",
  B: "var(--color-mtg-black)",
  R: "var(--color-mtg-red)",
  G: "var(--color-mtg-green)",
  Colorless: "var(--color-mtg-colorless)",
  Multicolor: "var(--color-mtg-multicolor)",
};

const COLOR_LABEL: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  Colorless: "Colorless",
  Multicolor: "Multicolor",
};

export default async function DashboardPage() {
  const [value, snapshots, topCards, deckSummaries, insights] =
    await Promise.all([
      computeCollectionValue(),
      fetchSnapshots(null),
      fetchTopCardsByValue(20),
      fetchDeckSummaries(),
      fetchInsights(),
    ]);

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const priorSnapshot = [...snapshots]
    .reverse()
    .find((s) => s.date <= thirtyDaysAgo);
  const valueDelta30d = priorSnapshot
    ? value.marketValueUsd - priorSnapshot.marketValueUsd
    : null;
  const valueDelta30dPct =
    priorSnapshot && priorSnapshot.marketValueUsd > 0
      ? (value.marketValueUsd / priorSnapshot.marketValueUsd - 1) * 100
      : null;

  const unrealizedPct =
    value.costBasisUsd > 0
      ? (value.unrealizedGainUsd / value.costBasisUsd) * 100
      : null;

  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
  const hasRealized =
    value.realizedGainUsd !== 0 || value.realizedProceedsUsd !== 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <header className="space-y-2 border-b border-[var(--border-subtle)] pb-5">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Dashboard
        </p>
        <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
          Collection snapshot
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          What you own, what it&rsquo;s worth, what your decks are doing right
          now.
        </p>
      </header>

      {/* ── Hero: collection value ── */}
      <section className="rounded-md border border-border-strong bg-surface-raised">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-6 py-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
              Market value
            </p>
            <p className="num text-[56px] font-semibold leading-none text-text-primary">
              <span className="text-[28px] text-text-muted">$</span>
              {value.marketValueUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wide">
              {valueDelta30d != null ? (
                <>
                  <ValueDelta value={valueDelta30d} className="text-[13px]" />
                  {valueDelta30dPct != null && (
                    <span
                      className={cn(
                        "num text-[11px]",
                        valueDelta30dPct >= 0
                          ? "text-[var(--color-value-positive)]"
                          : "text-[var(--color-value-negative)]",
                      )}
                    >
                      {valueDelta30dPct >= 0 ? "+" : ""}
                      {valueDelta30dPct.toFixed(2)}%
                    </span>
                  )}
                  <span className="text-text-muted">· vs 30d ago</span>
                </>
              ) : (
                <span className="text-text-muted">
                  30d trend accumulating
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 self-end font-mono text-[11px] lg:border-l lg:border-border-subtle lg:pl-8">
            <LedgerRow
              label="Cost basis"
              value={`$${formatNum(value.costBasisUsd)}`}
            />
            <LedgerRow
              label="Unrealized"
              value={
                <span
                  className={cn(
                    "num",
                    value.unrealizedGainUsd > 0
                      ? "text-[var(--color-value-positive)]"
                      : value.unrealizedGainUsd < 0
                        ? "text-[var(--color-value-negative)]"
                        : "text-text-muted",
                  )}
                >
                  {value.unrealizedGainUsd >= 0 ? "+" : "−"}$
                  {formatNum(Math.abs(value.unrealizedGainUsd))}
                  {unrealizedPct != null && (
                    <span className="ml-1 text-text-muted">
                      ({unrealizedPct >= 0 ? "+" : ""}
                      {unrealizedPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              }
            />
            <LedgerRow
              label="Cards"
              value={`${value.totalCards.toLocaleString()} · ${value.uniqueCards.toLocaleString()} uq`}
            />
            <LedgerRow
              label="Foil"
              value={value.foilCount.toLocaleString()}
            />
            {hasRealized && (
              <LedgerRow
                label="Realized"
                value={
                  <span
                    className={cn(
                      "num",
                      value.realizedGainUsd >= 0
                        ? "text-[var(--color-value-positive)]"
                        : "text-[var(--color-value-negative)]",
                    )}
                  >
                    {value.realizedGainUsd >= 0 ? "+" : "−"}$
                    {formatNum(Math.abs(value.realizedGainUsd))}
                  </span>
                }
              />
            )}
            {latestSnapshot && (
              <LedgerRow
                label="Updated"
                value={
                  <span className="text-text-muted">
                    {new Date(latestSnapshot.date).toLocaleDateString()}
                  </span>
                }
              />
            )}
          </dl>
        </div>
      </section>

      {/* ── Value chart ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Value over time
          </CardTitle>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-[var(--color-value-positive)]" />
              market
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-3"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, var(--color-text-muted) 50%, transparent 50%)",
                  backgroundSize: "4px 1px",
                  backgroundRepeat: "repeat-x",
                }}
              />
              cost basis
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ValueChart snapshots={snapshots} />
        </CardContent>
      </Card>

      {/* ── Decks + insights ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Decks · {deckSummaries.length}
            </CardTitle>
            <Link
              href="/decks"
              className="font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
            >
              All →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {deckSummaries.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-text-muted">
                No decks yet.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-border-subtle bg-surface-inset/40 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Deck</th>
                    <th className="px-2 py-1.5 text-left">Commander</th>
                    <th className="px-2 py-1.5 text-center">Target</th>
                    <th className="px-2 py-1.5 text-center">Calc</th>
                    <th className="px-2 py-1.5 text-right">Cards</th>
                    <th className="px-3 py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {deckSummaries.map((d) => {
                    const over =
                      d.targetBracket != null &&
                      d.calculatedBracket != null &&
                      d.calculatedBracket > d.targetBracket;
                    return (
                      <tr
                        key={d.id}
                        className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-inset/40"
                      >
                        <td className="px-3 py-1.5">
                          <Link
                            href={`/decks/${d.id}`}
                            className="font-medium text-text-primary hover:underline"
                          >
                            {d.name}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-text-muted">
                          {d.commanderName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <BracketBadge bracket={d.targetBracket} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="inline-flex items-center gap-1">
                            <BracketBadge bracket={d.calculatedBracket} />
                            {over && (
                              <span
                                className="size-1.5 rounded-full bg-[var(--color-bracket-3)]"
                                aria-label="Over target"
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span className="num text-text-primary">
                            {d.totalCards}
                            <span className="text-text-muted">/100</span>
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className="num text-text-primary">
                            ${d.totalValueUsd.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <InsightCard
            title="By color"
            entries={insights.colorDistribution}
            getTint={(label) => COLOR_TOKEN[label]}
            relabel={(label) => COLOR_LABEL[label] ?? label}
          />
          <InsightCard title="By type" entries={insights.typeDistribution} />
          <InsightCard title="Top sets" entries={insights.topSets} mono />
        </div>
      </div>

      {/* ── Most valuable cards (crown jewels) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Most valuable · top 20
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topCards.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-text-muted">
              No inventory yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-border-subtle md:grid-cols-2 md:divide-x md:divide-y-0">
              {[topCards.slice(0, 10), topCards.slice(10, 20)].map(
                (group, gi) => (
                  <ul key={gi} className="divide-y divide-border-subtle">
                    {group.map((c, i) => (
                      <li
                        key={`${c.oracleId}-${c.printingId}`}
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-inset/40"
                      >
                        <span className="num w-6 shrink-0 text-right text-[11px] text-text-muted">
                          {gi * 10 + i + 1}
                        </span>
                        {c.imageUri ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUri}
                            alt={c.name}
                            className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle">
                            <ImageOff className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/cards/${c.oracleId}`}
                            className="block truncate text-[13px] font-medium text-text-primary hover:underline"
                          >
                            {c.name}
                          </Link>
                          <p className="truncate font-mono text-[10px] uppercase tracking-wide text-text-muted">
                            {c.setName} · {c.setCode}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="num text-[13px] font-semibold text-text-primary">
                            ${c.totalValueUsd.toFixed(2)}
                          </p>
                          <p className="num text-[10px] text-text-muted">
                            {c.count} × ${c.unitPriceUsd.toFixed(2)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatNum(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function LedgerRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle/60 pb-1 last:border-b-0 last:pb-0">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
        {label}
      </dt>
      <dd className="num text-right text-[12px] text-text-primary">{value}</dd>
    </div>
  );
}

function InsightCard({
  title,
  entries,
  getTint,
  relabel,
  mono,
}: {
  title: string;
  entries: Array<{ label: string; count: number }>;
  getTint?: (label: string) => string | undefined;
  relabel?: (label: string) => string;
  mono?: boolean;
}) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-3">
        {entries.length === 0 ? (
          <p className="text-[11px] text-text-muted">No data.</p>
        ) : (
          <ul className="space-y-1">
            {entries.slice(0, 7).map((e) => {
              const tint = getTint?.(e.label) ?? "var(--color-text-secondary)";
              const width = Math.max(2, Math.round((e.count / max) * 100));
              return (
                <li key={e.label} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span
                      className={cn(
                        "truncate",
                        mono &&
                          "font-mono uppercase tracking-wide text-text-secondary",
                      )}
                    >
                      {relabel ? relabel(e.label) : e.label}
                    </span>
                    <span className="num shrink-0 text-text-muted">
                      {e.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-inset/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        background: tint,
                        opacity: getTint ? 0.8 : 0.4,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
