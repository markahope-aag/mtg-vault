import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeCollectionValue } from "@/db/queries/collection-value";
import {
  fetchSnapshots,
  fetchTopCardsByValue,
  fetchDeckSummaries,
  fetchInsights,
} from "@/lib/dashboard/queries";
import { ValueChart } from "@/components/dashboard/value-chart";
import { CollectionHero } from "@/components/dashboard/hero";
import { DecksTable } from "@/components/dashboard/decks-table";
import { TopCardsGrid } from "@/components/dashboard/top-cards-grid";
import {
  InsightCard,
  COLOR_TOKEN,
  COLOR_LABEL,
  COLOR_MANA,
} from "@/components/dashboard/insight-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [value, snapshots, topCards, deckSummaries, insights] =
    await Promise.all([
      computeCollectionValue(),
      fetchSnapshots(null),
      fetchTopCardsByValue(20),
      fetchDeckSummaries(),
      fetchInsights(),
    ]);

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

      <CollectionHero value={value} snapshots={snapshots} />

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <DecksTable deckSummaries={deckSummaries} />
        <div className="space-y-4">
          <InsightCard
            title="By color"
            entries={insights.colorDistribution}
            getTint={(label) => COLOR_TOKEN[label]}
            relabel={(label) => COLOR_LABEL[label] ?? label}
            getIcon={(label) => COLOR_MANA[label] ?? null}
          />
          <InsightCard title="By type" entries={insights.typeDistribution} />
          <InsightCard
            title="Top sets"
            entries={insights.topSets}
            mono
            defaultTint="var(--color-mtg-multicolor)"
          />
        </div>
      </div>

      <TopCardsGrid topCards={topCards} />
    </div>
  );
}
