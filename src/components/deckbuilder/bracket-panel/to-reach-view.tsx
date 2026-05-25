"use client";

import Link from "next/link";
import type { BracketResult } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";
import { BRACKET_NAME } from "./constants";

// The right-rail "to reach a lower bracket" diff. Each target bracket
// below the current one expands into a list of suggested card
// removals (with rationale, combo-criticality flag, and optional
// "Remove" action that the parent wires through to deck mutation).

export function ToReachBracketView({
  toReach,
  currentBracket,
  onRemoveCard,
}: {
  toReach: BracketResult["toReachBracket"];
  currentBracket: number;
  onRemoveCard?: (oracleId: string) => Promise<void> | void;
}) {
  const targets = Object.keys(toReach)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => n < currentBracket)
    .sort((a, b) => b - a);

  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        To reach a lower bracket
      </h3>
      {targets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-subtle px-3 py-4 text-center text-xs text-text-muted">
          Already at the lowest auto-detectable bracket.
        </p>
      ) : (
        <div className="space-y-2">
          {targets.map((t) => {
            const entry = toReach[t];
            if (!entry) return null;
            return (
              <details
                key={t}
                className="group/diff overflow-hidden rounded-md border border-border-subtle bg-surface-raised"
                open={t === currentBracket - 1}
              >
                <summary
                  className={cn(
                    "flex cursor-pointer items-center justify-between border-l-2 px-3 py-2 transition-colors hover:bg-surface-inset/40",
                  )}
                  style={{
                    borderLeftColor: `var(--color-bracket-${t})`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="num text-[15px] font-semibold"
                      style={{ color: `var(--color-bracket-${t})` }}
                    >
                      B{t}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                      {BRACKET_NAME[t]}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    {entry.remove.length} change
                    {entry.remove.length === 1 ? "" : "s"}
                  </span>
                </summary>
                {entry.note && (
                  <p className="border-t border-border-subtle bg-surface-inset/30 px-3 py-2 text-[11px] text-text-secondary">
                    {entry.note}
                  </p>
                )}
                {entry.remove.length > 0 && (
                  <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                    {entry.remove.map((r, i) => (
                      <li
                        key={`${r.oracleId}-${i}`}
                        className="group/r flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-surface-inset/40"
                      >
                        <div className="min-w-0 flex-1">
                          {r.oracleId ? (
                            <Link
                              href={`/cards/${r.oracleId}`}
                              className="text-[13px] font-medium text-text-primary hover:underline"
                            >
                              {r.name}
                            </Link>
                          ) : (
                            <span className="text-[13px] font-medium text-text-primary">
                              {r.name}
                            </span>
                          )}
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                            {r.criticalForCombo && (
                              <span className="text-[var(--color-value-negative)]">
                                combo ·{" "}
                              </span>
                            )}
                            {r.reason}
                          </p>
                        </div>
                        {onRemoveCard && r.oracleId && (
                          <button
                            type="button"
                            onClick={() => void onRemoveCard(r.oracleId)}
                            // Reveal pattern matches decklist:
                            // hover/focus/touch all surface the
                            // action. Plain `group-hover/r:opacity-100`
                            // is enough for mouse; the
                            // [@media(hover:none)] catches touch.
                            className="inline-flex h-6 items-center gap-1 rounded-sm border border-border-subtle bg-surface-base px-2 font-mono text-[10px] uppercase tracking-wide text-text-muted opacity-0 transition-opacity hover:border-[var(--color-value-negative)]/40 hover:text-[var(--color-value-negative)] focus-visible:opacity-100 focus-visible:text-[var(--color-value-negative)] group-hover/r:opacity-100 group-focus-within/r:opacity-100 [@media(hover:none)]:opacity-100"
                            title="Remove this card from the deck"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
