"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BracketResult } from "@/lib/bracket-engine";

type SnapshotRow = {
  id: string;
  snapshotAt: string;
  totalValueUsd: string | null;
  calculatedBracket: number | null;
  bracketReasons: unknown;
};

const BRACKET_LABEL: Record<number, string> = {
  1: "B1 Exhibition",
  2: "B2 Core",
  3: "B3 Upgraded",
  4: "B4 Optimized",
  5: "B5 cEDH",
};

const BRACKET_TONE: Record<number, string> = {
  1: "bg-stone-200 text-stone-900",
  2: "bg-emerald-100 text-emerald-900",
  3: "bg-amber-100 text-amber-900",
  4: "bg-orange-200 text-orange-900",
  5: "bg-rose-200 text-rose-900",
};

const SEVERITY_TONE: Record<string, string> = {
  blocking: "border-rose-300 bg-rose-50/70 text-rose-900",
  limiting: "border-amber-300 bg-amber-50/70 text-amber-900",
  note: "border-border bg-muted/40 text-muted-foreground",
};

export function BracketPanel({
  open,
  onOpenChange,
  deckId,
  targetBracket,
  onRemoveCard,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  deckId: string;
  targetBracket: number | null;
  onRemoveCard?: (oracleId: string) => Promise<void> | void;
}) {
  const [result, setResult] = useState<BracketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/decks/${deckId}/snapshots`);
      if (!res.ok) return;
      const data = (await res.json()) as { snapshots: SnapshotRow[] };
      setSnapshots(data.snapshots ?? []);
    } catch {
      /* ignore */
    }
  }, [deckId]);

  const recalculate = useCallback(
    async (writeSnapshot = true) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/decks/${deckId}/bracket?writeSnapshot=${writeSnapshot}`,
          { method: "POST" },
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as BracketResult;
        setResult(data);
        if (writeSnapshot) await loadSnapshots();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        toast.error(`Bracket calculation failed: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [deckId, loadSnapshots],
  );

  // When the panel opens, load the latest snapshot first (instant), then
  // auto-recalc if it's older than 60s.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      await loadSnapshots();
      if (cancelled) return;
      const latest = snapshots[0];
      const age = latest
        ? Date.now() - new Date(latest.snapshotAt).getTime()
        : Infinity;
      if (!latest || age > 60_000) {
        await recalculate(true);
      } else if (latest.calculatedBracket && latest.bracketReasons) {
        // Hydrate result from the snapshot row
        const reasons = latest.bracketReasons as {
          reasons?: BracketResult["reasons"];
          metrics?: BracketResult["metrics"];
          confidence?: BracketResult["confidence"];
          spellbookAvailable?: boolean;
          spellbookBracket?: number | null;
        };
        setResult({
          bracket: latest.calculatedBracket as 1 | 2 | 3 | 4 | 5,
          confidence: reasons.confidence ?? "calculated",
          reasons: reasons.reasons ?? [],
          metrics: reasons.metrics ?? {
            gameChangerCount: 0,
            twoCardComboCount: 0,
            multiCardComboCount: 0,
            massLandDenialCount: 0,
            extraTurnCount: 0,
            tutorCount: 0,
            deckSize: 0,
            commanderColorIdentity: [],
          },
          toReachBracket: {},
          spellbookAvailable: reasons.spellbookAvailable ?? true,
          spellbookBracket: reasons.spellbookBracket ?? null,
          spellbookBracketTag: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deckId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bracket</DialogTitle>
          <DialogDescription className="sr-only">
            Computed bracket and the reasons that drove it.
          </DialogDescription>
        </DialogHeader>

        {loading && !result && (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Calculating…
          </div>
        )}

        {error && !loading && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => recalculate()}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {result && (
          <BracketResultView
            result={result}
            targetBracket={targetBracket}
            snapshots={snapshots}
            onRecalc={() => recalculate(true)}
            recalculating={loading}
            onRemoveCard={onRemoveCard}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BracketResultView({
  result,
  targetBracket,
  snapshots,
  onRecalc,
  recalculating,
  onRemoveCard,
}: {
  result: BracketResult;
  targetBracket: number | null;
  snapshots: SnapshotRow[];
  onRecalc: () => Promise<void>;
  recalculating: boolean;
  onRemoveCard?: (oracleId: string) => Promise<void> | void;
}) {
  const tone = BRACKET_TONE[result.bracket];
  const subline = useMemo(() => {
    if (targetBracket == null) return null;
    if (targetBracket === result.bracket)
      return `On target (${BRACKET_LABEL[targetBracket]}).`;
    const diff = result.bracket - targetBracket;
    if (diff > 0)
      return `Target: ${BRACKET_LABEL[targetBracket]} · Calculated: ${BRACKET_LABEL[result.bracket]} — over by ${diff}.`;
    return `Target: ${BRACKET_LABEL[targetBracket]} · Calculated: ${BRACKET_LABEL[result.bracket]} — below target by ${Math.abs(diff)}.`;
  }, [targetBracket, result.bracket]);

  const grouped = useMemo(() => {
    const blocking = result.reasons.filter((r) => r.severity === "blocking");
    const limiting = result.reasons.filter((r) => r.severity === "limiting");
    const notes = result.reasons.filter((r) => r.severity === "note");
    return { blocking, limiting, notes };
  }, [result.reasons]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-base font-semibold ${tone}`}
          >
            {BRACKET_LABEL[result.bracket]}
          </div>
          {subline && (
            <p className="text-xs text-muted-foreground">{subline}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Confidence: {result.confidence}</span>
            {result.spellbookBracketTag && (
              <span className="text-muted-foreground/80">
                · Spellbook tag: {result.spellbookBracketTag}
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onRecalc()}
          disabled={recalculating}
        >
          {recalculating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Recalculate
        </Button>
      </div>

      <MetricsRow metrics={result.metrics} />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Why this bracket
        </h3>
        {result.reasons.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notable reasons.</p>
        ) : (
          <ul className="space-y-2">
            {[...grouped.blocking, ...grouped.limiting, ...grouped.notes].map(
              (r, i) => (
                <li
                  key={i}
                  className={`rounded-md border px-3 py-2 text-xs ${SEVERITY_TONE[r.severity]}`}
                >
                  <p className="font-medium">{r.text}</p>
                  {r.cards && r.cards.length > 0 && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] underline-offset-2 hover:underline">
                        Show {r.cards.length} card
                        {r.cards.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-[11px]">
                        {r.cards.map((c, j) => (
                          <li key={j}>
                            {c.oracleId ? (
                              <Link
                                href={`/cards/${c.oracleId}`}
                                target="_blank"
                                rel="noopener"
                                className="hover:underline"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              <span>{c.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <ToReachBracketView
        toReach={result.toReachBracket}
        currentBracket={result.bracket}
        onRemoveCard={onRemoveCard}
      />

      <SnapshotHistory snapshots={snapshots} />
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: BracketResult["metrics"] }) {
  const chips = [
    { label: "GC", value: metrics.gameChangerCount, tone: "rose" },
    { label: "2-card combos", value: metrics.twoCardComboCount, tone: "rose" },
    { label: "Multi combos", value: metrics.multiCardComboCount, tone: "amber" },
    { label: "MLD", value: metrics.massLandDenialCount, tone: "amber" },
    { label: "Extra turns", value: metrics.extraTurnCount, tone: "amber" },
    { label: "Tutors", value: metrics.tutorCount, tone: "sky" },
    { label: "Cards", value: metrics.deckSize, tone: "stone" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {chips.map((c) => (
        <Badge
          key={c.label}
          variant={c.value > 0 ? "secondary" : "outline"}
          className="tabular-nums"
        >
          {c.label}: {c.value}
        </Badge>
      ))}
    </div>
  );
}

function ToReachBracketView({
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
  if (targets.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          To reach a lower bracket
        </h3>
        <p className="text-xs text-muted-foreground">
          You&rsquo;re already at the lowest auto-detectable bracket.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        To reach a lower bracket
      </h3>
      <div className="space-y-2">
        {targets.map((t) => {
          const entry = toReach[t];
          if (!entry) return null;
          return (
            <details
              key={t}
              className="rounded-md border bg-card"
              open={t === currentBracket - 1}
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Reach {BRACKET_LABEL[t]}{" "}
                <span className="text-xs text-muted-foreground">
                  ({entry.remove.length} change
                  {entry.remove.length === 1 ? "" : "s"})
                </span>
              </summary>
              {entry.note && (
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                  {entry.note}
                </p>
              )}
              {entry.remove.length > 0 && (
                <ul className="divide-y border-t">
                  {entry.remove.map((r, i) => (
                    <li
                      key={`${r.oracleId}-${i}`}
                      className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        {r.oracleId ? (
                          <Link
                            href={`/cards/${r.oracleId}`}
                            target="_blank"
                            rel="noopener"
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.name}</span>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {r.reason}
                        </p>
                      </div>
                      {onRemoveCard && r.oracleId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onRemoveCard(r.oracleId)}
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

function SnapshotHistory({ snapshots }: { snapshots: SnapshotRow[] }) {
  if (snapshots.length < 2) return null;
  const ordered = [...snapshots].reverse();
  const max = 5;
  const min = 1;
  const points = ordered.map((s) => ({
    bracket: s.calculatedBracket ?? min,
    at: new Date(s.snapshotAt).getTime(),
  }));
  const first = points[0].at;
  const last = points[points.length - 1].at;
  const span = Math.max(1, last - first);
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Bracket history ({snapshots.length})
      </h3>
      <svg viewBox="0 0 400 80" className="h-20 w-full">
        <line x1="0" y1="0" x2="0" y2="80" stroke="currentColor" opacity="0.1" />
        <line
          x1="0"
          y1="80"
          x2="400"
          y2="80"
          stroke="currentColor"
          opacity="0.1"
        />
        {points.map((p, i) => {
          const x = ((p.at - first) / span) * 380 + 10;
          const y = 70 - ((p.bracket - min) / (max - min)) * 60;
          return (
            <g key={i}>
              {i > 0 && (
                <line
                  x1={((points[i - 1].at - first) / span) * 380 + 10}
                  y1={70 - ((points[i - 1].bracket - min) / (max - min)) * 60}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity="0.4"
                />
              )}
              <circle cx={x} cy={y} r="3" fill="currentColor" opacity="0.7" />
            </g>
          );
        })}
        <text x="0" y="12" fontSize="9" fill="currentColor" opacity="0.5">
          B{max}
        </text>
        <text x="0" y="78" fontSize="9" fill="currentColor" opacity="0.5">
          B{min}
        </text>
      </svg>
      <p className="text-[10px] text-muted-foreground">
        {new Date(ordered[0].snapshotAt).toLocaleDateString()} →{" "}
        {new Date(ordered[ordered.length - 1].snapshotAt).toLocaleDateString()}
      </p>
    </section>
  );
}
