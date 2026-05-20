import Link from "next/link";
import { ImageOff, Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeCollectionValue } from "@/db/queries/collection-value";
import {
  fetchSnapshots,
  fetchTopCardsByValue,
  fetchDeckSummaries,
  fetchInsights,
} from "@/lib/dashboard/queries";
import { ValueChart } from "@/components/dashboard/value-chart";

export const dynamic = "force-dynamic";

const BRACKET_LABEL: Record<number, string> = {
  1: "B1",
  2: "B2",
  3: "B3",
  4: "B4",
  5: "B5",
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

  // Compute 30-day-ago delta from snapshots. Server-component render — running
  // Date.now() once per request is intentional, not an impurity.
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

  const unrealizedTone =
    value.unrealizedGainUsd > 0
      ? "text-emerald-700"
      : value.unrealizedGainUsd < 0
        ? "text-rose-700"
        : "text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot of your collection&rsquo;s health.
        </p>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Collection value"
          value={`$${value.marketValueUsd.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subline={
            valueDelta30d != null ? (
              <span
                className={
                  valueDelta30d >= 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {valueDelta30d >= 0 ? "+" : "−"}$
                {Math.abs(valueDelta30d).toFixed(2)} vs 30d ago
              </span>
            ) : (
              <span className="text-muted-foreground">
                30d delta accumulating
              </span>
            )
          }
        />
        <Stat
          label="Cost basis"
          value={`$${value.costBasisUsd.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subline={
            <span className={unrealizedTone}>
              {value.unrealizedGainUsd >= 0 ? "+" : "−"}$
              {Math.abs(value.unrealizedGainUsd).toFixed(2)} unrealized
            </span>
          }
        />
        <Stat
          label="Cards"
          value={`${value.totalCards.toLocaleString()}`}
          subline={
            <span>
              {value.uniqueCards.toLocaleString()} unique ·{" "}
              {value.foilCount.toLocaleString()} foil
            </span>
          }
        />
        {value.realizedGainUsd !== 0 ||
        value.realizedProceedsUsd !== 0 ? (
          <Stat
            label="Realized gain"
            value={`${value.realizedGainUsd >= 0 ? "+" : "−"}$${Math.abs(
              value.realizedGainUsd,
            ).toFixed(2)}`}
            subline={
              <span>
                ${value.realizedProceedsUsd.toFixed(2)} from disposed cards
              </span>
            }
            tone={value.realizedGainUsd >= 0 ? "green" : "red"}
          />
        ) : (
          <Stat
            label="Realized gain"
            value="—"
            subline={
              <span className="text-muted-foreground">No disposals yet</span>
            }
          />
        )}
      </section>

      {/* Value chart */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ValueChart snapshots={snapshots} />
          </CardContent>
        </Card>
      </section>

      {/* Decks summary */}
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Decks ({deckSummaries.length})
            </CardTitle>
            <Link
              href="/decks"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All decks →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {deckSummaries.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No decks yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Deck</th>
                    <th className="px-2 py-2 text-left">Commander</th>
                    <th className="px-2 py-2 text-center">Target</th>
                    <th className="px-2 py-2 text-center">Calculated</th>
                    <th className="px-2 py-2 text-right">Cards</th>
                    <th className="px-4 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {deckSummaries.map((d) => {
                    const over =
                      d.targetBracket != null &&
                      d.calculatedBracket != null &&
                      d.calculatedBracket > d.targetBracket;
                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/40">
                        <td className="px-4 py-2">
                          <Link
                            href={`/decks/${d.id}`}
                            className="font-medium hover:underline"
                          >
                            {d.name}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          {d.commanderName ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {d.targetBracket
                            ? BRACKET_LABEL[d.targetBracket]
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {d.calculatedBracket
                            ? BRACKET_LABEL[d.calculatedBracket]
                            : "—"}
                          {over && (
                            <span
                              className="ml-1 inline-block size-1.5 rounded-full bg-amber-500"
                              title="Over target bracket"
                            />
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {d.totalCards}/100
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          ${d.totalValueUsd.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Most valuable + Insights */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Most valuable cards (top 20)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCards.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No inventory yet.
              </p>
            ) : (
              <ul className="divide-y">
                {topCards.map((c) => (
                  <li
                    key={`${c.oracleId}-${c.printingId}`}
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/40"
                  >
                    {c.imageUri ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUri}
                        alt={c.name}
                        className="size-10 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageOff className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cards/${c.oracleId}`}
                        className="truncate font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.setName} · {c.setCode.toUpperCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums">
                      <p className="font-semibold">
                        ${c.totalValueUsd.toFixed(2)}
                      </p>
                      <p className="text-muted-foreground">
                        {c.count} × ${c.unitPriceUsd.toFixed(2)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <InsightCard title="By color" entries={insights.colorDistribution} />
          <InsightCard title="By type" entries={insights.typeDistribution} />
          <InsightCard title="Top sets" entries={insights.topSets} />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  subline,
  tone,
}: {
  label: string;
  value: string;
  subline: React.ReactNode;
  tone?: "green" | "red";
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-700" : ""}`}
        >
          {value}
        </p>
        <p className="text-[11px]">{subline}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data.</p>
        ) : (
          <ul className="space-y-1">
            {entries.slice(0, 8).map((e) => (
              <li key={e.label} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span>{e.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {e.count}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-foreground/20"
                  style={{ width: `${Math.round((e.count / max) * 100)}%` }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
