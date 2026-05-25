"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import type { BracketResult } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";
import {
  BRACKET_HERO_TONE,
  BRACKET_NAME,
  SEVERITY_PRESENTATION,
  type SnapshotRow,
} from "./constants";
import { SnapshotHistory } from "./snapshot-history";
import { ToReachBracketView } from "./to-reach-view";

// The full BracketResult layout: hero band on top with B-number + name
// + ledger (target/calc/delta + recalc button), metric chips row,
// reasons list (grouped by severity), then a right rail with the
// "to reach lower bracket" details + history sparkline.

export function BracketResultView({
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

        <ReasonsList grouped={grouped} reasonsCount={result.reasons.length} />
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

// ─── Ledger ──────────────────────────────────────────────────────

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

// ─── Metrics chips ───────────────────────────────────────────────

function MetricsRow({ metrics }: { metrics: BracketResult["metrics"] }) {
  const chips: Array<{
    label: string;
    value: number;
    tone?: "rose" | "amber" | "sky";
  }> = [
    { label: "Game Changers", value: metrics.gameChangerCount, tone: "rose" },
    { label: "2-card combo", value: metrics.twoCardComboCount, tone: "rose" },
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
    { label: "Extra turns", value: metrics.extraTurnCount, tone: "amber" },
    { label: "Tutors", value: metrics.tutorCount, tone: "sky" },
    { label: "Deck size", value: metrics.deckSize },
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
              c.value === 0 ? "text-text-muted" : "text-text-secondary",
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

// ─── Reasons list ────────────────────────────────────────────────

function ReasonsList({
  grouped,
  reasonsCount,
}: {
  grouped: {
    blocking: BracketResult["reasons"];
    limiting: BracketResult["reasons"];
    notes: BracketResult["reasons"];
  };
  reasonsCount: number;
}) {
  return (
    <section className="space-y-2">
      <SeverityHeader
        blocking={grouped.blocking.length}
        limiting={grouped.limiting.length}
        notes={grouped.notes.length}
      />
      {reasonsCount === 0 ? (
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
        <SeverityCount count={notes} dot="bg-text-muted" label="note" />
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
