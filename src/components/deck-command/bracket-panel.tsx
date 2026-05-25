import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BracketBadge } from "@/components/bracket-badge";
import { RecalcButton } from "./recalc-button";
import type { CachedBracket } from "@/lib/decks/command-data";

export function BracketPanel({
  deckId,
  bracket,
}: {
  deckId: string;
  bracket: CachedBracket;
}) {
  const over =
    bracket.targetBracket != null &&
    bracket.calculatedBracket != null &&
    bracket.calculatedBracket > bracket.targetBracket;
  const targetCuts = over
    ? bracket.toReachBracket?.[String(bracket.targetBracket)]?.remove ?? []
    : [];
  const topReasons = bracket.reasons
    .filter((r) => r.severity !== "note")
    .slice(0, 3);

  return (
    <Card className={over ? "border-[var(--color-bracket-4)]/40" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Bracket
        </CardTitle>
        <RecalcButton
          deckId={deckId}
          endpoint={`/api/decks/${deckId}/bracket`}
          lastAt={bracket.snapshotAt}
          label="Recalculate"
        />
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex items-baseline gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Calculated
            </p>
            <BracketBadge bracket={bracket.calculatedBracket} showName />
          </div>
          <span className="font-mono text-text-muted">vs</span>
          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Target
            </p>
            <BracketBadge bracket={bracket.targetBracket} showName />
          </div>
          {over && (
            <span className="ml-auto rounded-sm bg-[var(--color-bracket-4)]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-bracket-4)]">
              Over target
            </span>
          )}
        </div>

        {topReasons.length > 0 && (
          <ul className="space-y-1 text-[12px] text-text-secondary">
            {topReasons.map((r, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span
                  className={
                    r.severity === "blocking"
                      ? "rounded-sm bg-[var(--value-negative)]/15 px-1 py-px font-mono text-[9px] uppercase text-[var(--value-negative)]"
                      : "rounded-sm bg-[var(--brand)]/15 px-1 py-px font-mono text-[9px] uppercase text-[var(--brand)]"
                  }
                >
                  {r.severity}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}

        {over && targetCuts.length > 0 && (
          <div className="space-y-1 border-t border-border-subtle pt-3">
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Cuts to drop to Bracket {bracket.targetBracket}
            </p>
            <ul className="space-y-0.5 text-[12px]">
              {targetCuts.slice(0, 6).map((c, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-text-muted">·</span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-text-muted">{c.reason}</span>
                </li>
              ))}
            </ul>
            {targetCuts.length > 6 && (
              <p className="font-mono text-[10px] uppercase text-text-muted">
                +{targetCuts.length - 6} more in the full bracket view
              </p>
            )}
          </div>
        )}

        {over && targetCuts.length === 0 && !bracket.toReachBracket && (
          <p className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-[11px] text-text-muted">
            Cut suggestions weren&rsquo;t in the last snapshot. Click
            Recalculate to populate them.
          </p>
        )}

        {bracket.snapshotAt == null && (
          <p className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-[11px] text-text-muted">
            No bracket snapshot yet — click Recalculate to compute.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
