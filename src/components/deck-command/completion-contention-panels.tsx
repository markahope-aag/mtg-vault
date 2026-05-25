import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReconcileResult } from "@/lib/rogue/reconcile";

// Reconcile drives BOTH panels — cheapest completion + pre-existing
// contention. Kept in one file because they read the same object and
// would just trampoline imports otherwise.

export function CompletionPanel({
  deckId,
  result,
  totalCards,
}: {
  deckId: string;
  result: ReconcileResult;
  totalCards: number;
}) {
  const ownedAndMovable = result.summary.totalCards - result.summary.mustBuyCount;
  const completionPct =
    result.summary.totalCards > 0
      ? Math.round((ownedAndMovable / result.summary.totalCards) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Completion
        </CardTitle>
        <Link
          href={`/decks/${deckId}/reconcile`}
          className="font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
        >
          Full →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex items-baseline gap-3">
          <p className="num text-[28px] font-semibold leading-none">
            {ownedAndMovable}
            <span className="text-[14px] text-text-muted">
              /{result.summary.totalCards}
            </span>
          </p>
          <span className="font-mono text-[11px] uppercase text-text-muted">
            owned + movable
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-inset">
          <div
            className="h-full rounded-full bg-[var(--value-positive)]/70"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="text-[13px]">
          <span className="font-mono text-[10px] uppercase text-text-muted">
            Cheapest completion
          </span>
          <br />
          <span className="num text-[20px] font-semibold">
            ${result.summary.cheapestCompletionUsd.toFixed(2)}
          </span>
          <span className="ml-2 text-[11px] text-text-muted">
            · {result.summary.mustBuyCount} to buy
          </span>
        </p>
        {totalCards < 100 && (
          <p className="rounded-md border border-dashed border-border-subtle px-3 py-1.5 font-mono text-[11px] uppercase text-text-muted">
            Deck has {totalCards} cards (counts include commander)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ContentionPanel({
  deckId,
  result,
}: {
  deckId: string;
  result: ReconcileResult;
}) {
  const items = result.preExistingContention.slice(0, 8);
  const more = result.preExistingContention.length - items.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Contention
        </CardTitle>
        <span className="font-mono text-[10px] uppercase text-text-muted">
          {result.preExistingContention.length} contested
        </span>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {items.length === 0 ? (
          <p className="empty-terminal py-2">
            no cross-deck conflicts — sleeve up freely
          </p>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {items.map((c) => (
              <li
                key={c.oracleId}
                className="flex items-baseline justify-between gap-2"
              >
                <Link
                  href={`/cards/${c.oracleId}`}
                  className="truncate text-text-primary hover:underline"
                >
                  {c.name}
                </Link>
                <span className="shrink-0 font-mono text-[10px] uppercase text-text-muted">
                  {c.ownedCount} owned · {c.claimedByDecks} decks claim
                </span>
              </li>
            ))}
            {more > 0 && (
              <li className="font-mono text-[10px] uppercase text-text-muted">
                <Link
                  href={`/decks/${deckId}/reconcile`}
                  className="hover:text-text-primary"
                >
                  +{more} more in full reconcile →
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
