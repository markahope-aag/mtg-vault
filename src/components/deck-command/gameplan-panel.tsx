import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecalcButton } from "./recalc-button";
import type { CachedAnalysis } from "@/lib/decks/command-data";

// Read-only summary of the cached LLM strategy analysis. The full view
// lives in the deckbuilder strategy pane; this panel just surfaces the
// headline (archetype + condensed gameplan + win cons) so the operator
// doesn't have to drill in to remember what this deck is supposed to do.
export function GameplanPanel({
  deckId,
  analysis,
}: {
  deckId: string;
  analysis: CachedAnalysis;
}) {
  if (!analysis.analysis) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Gameplan
          </CardTitle>
          <RecalcButton
            deckId={deckId}
            endpoint={`/api/decks/${deckId}/analyze`}
            method="POST"
            lastAt={null}
            label="Analyze"
            pendingLabel="Analyzing…"
          />
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 text-[12px] text-text-muted">
          <p className="rounded-md border border-dashed border-border-subtle px-3 py-2">
            No analysis yet. Run Analyze to produce an archetype, gameplan,
            and weak-spot read for this deck.
          </p>
        </CardContent>
      </Card>
    );
  }

  const a = analysis.analysis as {
    archetype?: string;
    winConditions?: string[];
    gameplan?: { early?: string; mid?: string; late?: string };
    weaknesses?: string[];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Gameplan
        </CardTitle>
        <div className="flex items-center gap-2">
          {analysis.isStale && (
            <span className="rounded-sm bg-[var(--brand)]/15 px-1.5 py-px font-mono text-[10px] uppercase text-[var(--brand)]">
              Stale
            </span>
          )}
          <RecalcButton
            deckId={deckId}
            endpoint={`/api/decks/${deckId}/analyze`}
            method="POST"
            lastAt={analysis.analyzedAt}
            label="Re-analyze"
            pendingLabel="Re-analyzing…"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 text-[13px]">
        {a.archetype && (
          <p>
            <span className="font-mono text-[10px] uppercase text-text-muted">
              Archetype
            </span>
            <br />
            <span className="font-medium">{a.archetype}</span>
          </p>
        )}
        {a.winConditions && a.winConditions.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Win conditions
            </p>
            <ul className="mt-1 space-y-0.5">
              {a.winConditions.slice(0, 3).map((w, i) => (
                <li key={i} className="text-[12px]">
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.gameplan && (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {(["early", "mid", "late"] as const).map((phase) =>
              a.gameplan?.[phase] ? (
                <div
                  key={phase}
                  className="rounded-md border border-border-subtle bg-surface-raised p-2"
                >
                  <p className="font-mono text-[9px] uppercase text-text-muted">
                    {phase}
                  </p>
                  <p className="mt-1">{a.gameplan[phase]}</p>
                </div>
              ) : null,
            )}
          </div>
        )}
        {a.weaknesses && a.weaknesses.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Weaknesses
            </p>
            <ul className="mt-1 space-y-0.5">
              {a.weaknesses.slice(0, 2).map((w, i) => (
                <li key={i} className="text-[12px] text-text-secondary">
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
