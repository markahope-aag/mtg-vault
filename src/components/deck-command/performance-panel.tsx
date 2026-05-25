import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BracketBadge } from "@/components/bracket-badge";
import type { DeckStats } from "@/lib/games/queries";

// Per-deck Phase 2 stats panel. Drawn from games + game_players. The
// inline "bracket-reality" call-out compares the deck's calculated
// bracket against its actual record at that pod bracket — same signal
// the global /games/stats page surfaces but scoped to this deck only.
export function PerformancePanel({
  stats,
  calculatedBracket,
}: {
  stats: DeckStats | null;
  calculatedBracket: number | null;
}) {
  if (!stats || stats.totalGames === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Performance
          </CardTitle>
          <Link
            href="/games/new"
            className="font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
          >
            Log →
          </Link>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 text-[12px] text-text-muted">
          <p className="rounded-md border border-dashed border-border-subtle px-3 py-2">
            No games logged for this deck. The bracket-reality check
            needs ≥5 games at the same pod bracket to fire.
          </p>
        </CardContent>
      </Card>
    );
  }

  const atCalculated = stats.byBracket.find(
    (b) => b.podBracket === calculatedBracket,
  );
  const signal =
    atCalculated && atCalculated.games >= 5
      ? atCalculated.winRatePct < 25
        ? "underperforming"
        : atCalculated.winRatePct > 75
          ? "overperforming"
          : null
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Performance
        </CardTitle>
        <Link
          href={`/games?deckId=${stats.deckId}`}
          className="font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
        >
          Log →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex items-baseline gap-3">
          <p className="num text-[28px] font-semibold leading-none">
            {stats.wins}
            <span className="text-text-muted">-{stats.losses}</span>
          </p>
          <span className="font-mono text-[11px] uppercase text-text-muted">
            {stats.winRatePct ?? 0}% over {stats.totalGames}
          </span>
        </div>

        {stats.byBracket.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              By bracket
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {stats.byBracket.map((b) => (
                <span
                  key={b.podBracket}
                  className="inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 text-[11px]"
                  title={`${b.wins}-${b.games - b.wins}`}
                >
                  <BracketBadge bracket={b.podBracket} />
                  <span className="num">
                    {b.wins}-{b.games - b.wins}
                  </span>
                  <span className="text-text-muted">({b.winRatePct}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {signal && atCalculated && (
          <div
            className={
              signal === "underperforming"
                ? "rounded-md border border-[var(--value-negative)]/30 bg-[var(--value-negative)]/10 px-3 py-2 text-[12px]"
                : "rounded-md border border-[var(--value-positive)]/30 bg-[var(--value-positive)]/10 px-3 py-2 text-[12px]"
            }
          >
            <p className="font-mono text-[10px] uppercase">
              Bracket-reality check
            </p>
            <p className="mt-1">
              {signal === "underperforming"
                ? `Calculated Bracket ${calculatedBracket}, but ${atCalculated.wins}-${atCalculated.games - atCalculated.wins} at Bracket ${atCalculated.podBracket} pods — may be playing below its bracket.`
                : `Winning ${atCalculated.winRatePct}% at Bracket ${atCalculated.podBracket} (${atCalculated.wins}-${atCalculated.games - atCalculated.wins}) — may be underbracketed.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
