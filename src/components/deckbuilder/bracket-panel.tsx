"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BracketResult } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";

type SnapshotRow = {
  id: string;
  snapshotAt: string;
  totalValueUsd: string | null;
  calculatedBracket: number | null;
  bracketReasons: unknown;
};

const BRACKET_NAME: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

const BRACKET_HERO_TONE: Record<number, string> = {
  1: "bg-[var(--color-bracket-1)]/12 text-[var(--color-bracket-1)] border-[var(--color-bracket-1)]/30",
  2: "bg-[var(--color-bracket-2)]/12 text-[var(--color-bracket-2)] border-[var(--color-bracket-2)]/30",
  3: "bg-[var(--color-bracket-3)]/12 text-[var(--color-bracket-3)] border-[var(--color-bracket-3)]/30",
  4: "bg-[var(--color-bracket-4)]/12 text-[var(--color-bracket-4)] border-[var(--color-bracket-4)]/30",
  5: "bg-[var(--color-bracket-5)]/12 text-[var(--color-bracket-5)] border-[var(--color-bracket-5)]/30",
};

const SEVERITY_PRESENTATION: Record<
  "blocking" | "limiting" | "note",
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    dot: string;
  }
> = {
  blocking: {
    label: "Blocking",
    border: "border-[var(--color-value-negative)]/40",
    bg: "bg-[var(--color-value-negative)]/8",
    text: "text-[var(--color-value-negative)]",
    dot: "bg-[var(--color-value-negative)]",
  },
  limiting: {
    label: "Limiting",
    border: "border-[var(--color-bracket-3)]/40",
    bg: "bg-[var(--color-bracket-3)]/8",
    text: "text-[var(--color-bracket-3)]",
    dot: "bg-[var(--color-bracket-3)]",
  },
  note: {
    label: "Note",
    border: "border-border-subtle",
    bg: "bg-surface-inset/50",
    text: "text-text-muted",
    dot: "bg-text-muted",
  },
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
        toast.error(`Couldn't recalculate bracket: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [deckId, loadSnapshots],
  );

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
      <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden rounded-md! border-border-strong bg-surface-overlay p-0">
        <DialogHeader className="border-b border-border-subtle bg-surface-base/60 px-5 py-2.5">
          <DialogTitle className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
            Bracket analysis
          </DialogTitle>
          <DialogDescription className="sr-only">
            Calculated bracket and the reasons driving it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-44px)] overflow-y-auto">
          {loading && !result && (
            <div className="flex items-center justify-center gap-2 py-20 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Calculating…
            </div>
          )}

          {error && !loading && (
            <div className="m-5 rounded-md border border-[var(--color-value-negative)]/40 bg-[var(--color-value-negative)]/8 px-4 py-3 text-sm text-[var(--color-value-negative)]">
              <p className="font-medium">Calculation failed.</p>
              <p className="mt-1 text-xs opacity-90">{error}</p>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => recalculate()}
                >
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
        </div>
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
  const heroTone = BRACKET_HERO_TONE[result.bracket];
  const overTarget =
    targetBracket != null && result.bracket > targetBracket;
  const underTarget =
    targetBracket != null && result.bracket < targetBracket;

  const grouped = useMemo(() => {
    const blocking = result.reasons.filter((r) => r.severity === "blocking");
    const limiting = result.reasons.filter((r) => r.severity === "limiting");
    const notes = result.reasons.filter((r) => r.severity === "note");
    return { blocking, limiting, notes };
  }, [result.reasons]);

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* ── LEFT: hero + reasons ── */}
      <div className="space-y-5 border-b border-border-subtle p-5 lg:border-b-0 lg:border-r">
        <section
          className={cn(
            "relative overflow-hidden rounded-md border px-5 py-4",
            heroTone,
          )}
        >
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-5">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
                Calculated
              </p>
              <p className="num text-[64px] font-semibold leading-none">
                B{result.bracket}
              </p>
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] opacity-80">
                {BRACKET_NAME[result.bracket]}
              </p>
            </div>

            <Ledger
              targetBracket={targetBracket}
              calculatedBracket={result.bracket}
              overTarget={overTarget}
              underTarget={underTarget}
              confidence={result.confidence}
              spellbookTag={result.spellbookBracketTag}
              spellbookAvailable={result.spellbookAvailable}
              onRecalc={onRecalc}
              recalculating={recalculating}
            />
          </div>
        </section>

        <MetricsRow metrics={result.metrics} />

        <section className="space-y-2">
          <SeverityHeader
            blocking={grouped.blocking.length}
            limiting={grouped.limiting.length}
            notes={grouped.notes.length}
          />
          {result.reasons.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-subtle px-3 py-4 text-center text-xs text-text-muted">
              No notable reasons.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[
                ...grouped.blocking,
                ...grouped.limiting,
                ...grouped.notes,
              ].map((r, i) => {
                const pres = SEVERITY_PRESENTATION[r.severity];
                return (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-2",
                      pres.border,
                      pres.bg,
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 inline-block size-1.5 shrink-0 rounded-full",
                          pres.dot,
                        )}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p
                          className={cn(
                            "flex items-baseline gap-2 text-[13px]",
                            r.severity === "note"
                              ? "text-text-secondary"
                              : "text-text-primary",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-[9px] uppercase tracking-[0.18em]",
                              pres.text,
                            )}
                          >
                            {pres.label}
                          </span>
                          <span>{r.text}</span>
                        </p>
                        {r.cards && r.cards.length > 0 && (
                          <details className="group/cards">
                            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-secondary">
                              {r.cards.length} card
                              {r.cards.length === 1 ? "" : "s"} ·
                              <span className="ml-1 underline-offset-2 group-hover/cards:underline">
                                show
                              </span>
                            </summary>
                            <ul className="mt-1 flex flex-wrap gap-1">
                              {r.cards.map((c, j) =>
                                c.oracleId ? (
                                  <li key={j}>
                                    <Link
                                      href={`/cards/${c.oracleId}`}
                                      className="inline-block rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-text-secondary hover:border-border-strong hover:text-text-primary"
                                    >
                                      {c.name}
                                    </Link>
                                  </li>
                                ) : (
                                  <li
                                    key={j}
                                    className="inline-block rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
                                  >
                                    {c.name}
                                  </li>
                                ),
                              )}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── RIGHT: action panel ── */}
      <div className="space-y-5 p-5">
        <ToReachBracketView
          toReach={result.toReachBracket}
          currentBracket={result.bracket}
          onRemoveCard={onRemoveCard}
        />
        <SnapshotHistory snapshots={snapshots} />
      </div>
    </div>
  );
}

function Ledger({
  targetBracket,
  calculatedBracket,
  overTarget,
  underTarget,
  confidence,
  spellbookTag,
  spellbookAvailable,
  onRecalc,
  recalculating,
}: {
  targetBracket: number | null;
  calculatedBracket: number;
  overTarget: boolean;
  underTarget: boolean;
  confidence: BracketResult["confidence"];
  spellbookTag: string | null;
  spellbookAvailable: boolean;
  onRecalc: () => Promise<void>;
  recalculating: boolean;
}) {
  const delta =
    targetBracket != null ? calculatedBracket - targetBracket : null;
  const deltaTone =
    delta == null
      ? "text-text-muted"
      : delta > 0
        ? "text-[var(--color-value-negative)]"
        : delta < 0
          ? "text-[var(--color-bracket-3)]"
          : "text-[var(--color-value-positive)]";
  const confidenceTone =
    confidence === "declared"
      ? "text-[var(--color-brand-strong)]"
      : confidence === "conservative"
        ? "text-[var(--color-bracket-3)]"
        : "text-text-muted";

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
          Target
        </dt>
        <dd className="num text-right">
          {targetBracket != null ? `B${targetBracket}` : "—"}
        </dd>
        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
          Calculated
        </dt>
        <dd className="num text-right font-semibold">B{calculatedBracket}</dd>
        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
          Δ
        </dt>
        <dd className={cn("num text-right", deltaTone)}>
          {delta == null
            ? "—"
            : delta === 0
              ? "on target"
              : delta > 0
                ? `+${delta} over`
                : `${delta} under`}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="space-y-0.5 font-mono text-[10px] uppercase tracking-[0.18em] opacity-80">
          <p className={confidenceTone}>· {confidence}</p>
          {spellbookTag && spellbookAvailable && (
            <p className="opacity-60">spellbook · {spellbookTag}</p>
          )}
          {!spellbookAvailable && (
            <p className="text-[var(--color-bracket-3)] opacity-80">
              spellbook offline
            </p>
          )}
          {overTarget && (
            <p className="text-[var(--color-value-negative)]">over target</p>
          )}
          {underTarget && (
            <p className="text-[var(--color-bracket-3)]">below target</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onRecalc()}
          disabled={recalculating}
          className="inline-flex h-7 items-center gap-1 rounded-sm border border-current/30 bg-surface-base/40 px-2 font-mono text-[10px] uppercase tracking-wide transition-colors hover:bg-surface-base/80 disabled:opacity-60"
        >
          {recalculating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Recalc
        </button>
      </div>
    </div>
  );
}

function SeverityHeader({
  blocking,
  limiting,
  notes,
}: {
  blocking: number;
  limiting: number;
  notes: number;
}) {
  return (
    <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
      Reasons
      <span className="ml-auto flex items-center gap-1.5">
        <SeverityCount
          count={blocking}
          dot="bg-[var(--color-value-negative)]"
          label="blocking"
        />
        <SeverityCount
          count={limiting}
          dot="bg-[var(--color-bracket-3)]"
          label="limiting"
        />
        <SeverityCount
          count={notes}
          dot="bg-text-muted"
          label="note"
        />
      </span>
    </h3>
  );
}

function SeverityCount({
  count,
  dot,
  label,
}: {
  count: number;
  dot: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        count === 0 && "opacity-40",
      )}
      title={`${count} ${label}`}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      <span className="num">{count}</span>
    </span>
  );
}

function MetricsRow({ metrics }: { metrics: BracketResult["metrics"] }) {
  const chips: Array<{
    label: string;
    value: number;
    tone?: "rose" | "amber" | "sky";
  }> = [
    {
      label: "Game Changers",
      value: metrics.gameChangerCount,
      tone: "rose",
    },
    {
      label: "2-card combo",
      value: metrics.twoCardComboCount,
      tone: "rose",
    },
    {
      label: "Multi combo",
      value: metrics.multiCardComboCount,
      tone: "amber",
    },
    {
      label: "Mass land denial",
      value: metrics.massLandDenialCount,
      tone: "amber",
    },
    {
      label: "Extra turns",
      value: metrics.extraTurnCount,
      tone: "amber",
    },
    {
      label: "Tutors",
      value: metrics.tutorCount,
      tone: "sky",
    },
    {
      label: "Deck size",
      value: metrics.deckSize,
    },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => {
        const dot =
          c.value === 0
            ? "bg-text-muted/40"
            : c.tone === "rose"
              ? "bg-[var(--color-value-negative)]"
              : c.tone === "amber"
                ? "bg-[var(--color-bracket-3)]"
                : c.tone === "sky"
                  ? "bg-[var(--color-mtg-blue)]"
                  : "bg-text-secondary";
        return (
          <li
            key={c.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
              c.value === 0
                ? "text-text-muted"
                : "text-text-secondary",
            )}
          >
            <span className={cn("size-1.5 rounded-full", dot)} />
            <span>{c.label}</span>
            <span className="num text-text-primary">{c.value}</span>
          </li>
        );
      })}
    </ul>
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
                            className="inline-flex h-6 items-center gap-1 rounded-sm border border-border-subtle bg-surface-base px-2 font-mono text-[10px] uppercase tracking-wide text-text-muted opacity-0 transition-opacity hover:border-[var(--color-value-negative)]/40 hover:text-[var(--color-value-negative)] group-hover/r:opacity-100"
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

function SnapshotHistory({ snapshots }: { snapshots: SnapshotRow[] }) {
  if (snapshots.length < 2) {
    return (
      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          History
        </h3>
        <p className="rounded-md border border-dashed border-border-subtle px-3 py-4 text-center text-xs text-text-muted">
          Bracket history accumulates with snapshots.
          {snapshots.length === 1 && " 1 snapshot so far."}
        </p>
      </section>
    );
  }

  const ordered = [...snapshots].reverse();
  const points = ordered
    .filter((s) => s.calculatedBracket != null)
    .map((s) => ({
      bracket: s.calculatedBracket as number,
      at: new Date(s.snapshotAt).getTime(),
    }));
  if (points.length < 2) {
    return null;
  }
  const first = points[0].at;
  const last = points[points.length - 1].at;
  const span = Math.max(1, last - first);
  const max = 5;
  const min = 1;

  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        History · {points.length} snapshots
      </h3>
      <div className="rounded-md border border-border-subtle bg-surface-raised p-3">
        <svg viewBox="0 0 400 90" className="h-24 w-full">
          {/* Horizontal gridlines for B1..B5 */}
          {[1, 2, 3, 4, 5].map((b) => {
            const y = 78 - ((b - min) / (max - min)) * 64;
            return (
              <g key={b}>
                <line
                  x1="24"
                  y1={y}
                  x2="396"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.06"
                  strokeDasharray="2 3"
                />
                <text
                  x="0"
                  y={y + 3}
                  fontFamily="var(--font-mono)"
                  fontSize="8"
                  fill={`var(--color-bracket-${b})`}
                  opacity="0.7"
                >
                  B{b}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const x = ((p.at - first) / span) * 360 + 32;
            const y = 78 - ((p.bracket - min) / (max - min)) * 64;
            const prev = i > 0 ? points[i - 1] : null;
            return (
              <g key={i}>
                {prev && (
                  <line
                    x1={((prev.at - first) / span) * 360 + 32}
                    y1={78 - ((prev.bracket - min) / (max - min)) * 64}
                    x2={x}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth="1.25"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill={`var(--color-bracket-${p.bracket})`}
                  opacity="0.9"
                />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wide text-text-muted">
          <span>{new Date(first).toLocaleDateString()}</span>
          <span>{new Date(last).toLocaleDateString()}</span>
        </div>
      </div>
    </section>
  );
}
