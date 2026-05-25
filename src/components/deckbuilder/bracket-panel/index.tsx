"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { BracketResultView } from "./result-view";
import type { SnapshotRow } from "./constants";

// Bracket-panel orchestrator. Owns:
//   - Dialog open/close
//   - The two server fetches (POST /bracket to recalculate, GET
//     /snapshots to load history)
//   - Recalc-on-open heuristic: if the latest snapshot is < 60s old,
//     hydrate from it; otherwise recompute.
//
// Presentation is in:
//   - result-view.tsx — the hero + ledger + reasons + right rail
//   - to-reach-view.tsx — the "lower bracket" diff (inside result-view)
//   - snapshot-history.tsx — the SVG sparkline
//   - constants.ts — BRACKET_NAME / hero tones / severity presentation
//     + the SnapshotRow type

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
