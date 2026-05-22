"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Compass,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useDeckbuilder } from "./shell";
import { ManaCost } from "@/components/mana-cost";
import {
  SLOT_LABEL,
  type Slot,
  type SlotStatus,
} from "@/lib/decks/slots";
import { cn } from "@/lib/utils";

type SlotRow = {
  slot: Slot;
  count: number;
  target: { min: number; max: number; ideal: number };
  status: SlotStatus;
};

type SlotSuggestion = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  edhrecRank: number | null;
  ownedCount: number;
};

type CoachResponse = {
  slots: SlotRow[];
  suggestions: Record<string, SlotSuggestion[]>;
};

const SLOT_TONE: Record<SlotStatus, string> = {
  under: "text-[var(--value-negative)]",
  ok: "text-[var(--value-positive)]",
  over: "text-[var(--brand-strong)]",
};

const SLOT_BAR_TONE: Record<SlotStatus, string> = {
  under: "bg-[var(--value-negative)]",
  ok: "bg-[var(--value-positive)]",
  over: "bg-[var(--brand)]",
};

export function CoachPane() {
  const { deck, addCard } = useDeckbuilder();
  const [data, setData] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<Slot>>(new Set());

  useEffect(() => {
    let cancelled = false;
    // Coach refreshes when the decklist changes (deck.cards.length is a
    // proxy for "decklist mutated").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/decks/${deck.deck.id}/coach`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CoachResponse | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deck.deck.id, deck.cards.length, deck.commander?.oracleId]);

  const toggle = useCallback((slot: Slot) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  const totalCards = useMemo(
    () => (data?.slots ?? []).reduce((s, r) => s + r.count, 0),
    [data],
  );

  if (loading) {
    return (
      <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-text-muted">
        <Loader2 className="size-4 animate-spin" />
      </aside>
    );
  }
  if (!data) {
    return (
      <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-text-muted">
        <p className="empty-terminal">coach unavailable</p>
      </aside>
    );
  }

  const slotsToShow = data.slots.filter(
    (s) => s.count > 0 || s.target.max > 0,
  );

  return (
    <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-inset/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Compass className="size-3.5 text-[var(--brand)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Build coach
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
          <span className="num text-text-primary">{totalCards}</span>/100 ·
          bracket{" "}
          <span className="num text-text-primary">
            {deck.deck.targetBracket ?? "—"}
          </span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-border-subtle">
          {slotsToShow.map((row) => {
            const isOpen = expanded.has(row.slot);
            const suggestions = data.suggestions[row.slot] ?? [];
            return (
              <li key={row.slot}>
                <button
                  type="button"
                  onClick={() => toggle(row.slot)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-inset/40"
                  aria-expanded={isOpen}
                >
                  <span className="text-text-muted">
                    {isOpen ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-text-primary">
                    {SLOT_LABEL[row.slot]}
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className={cn("num text-[14px] font-semibold", SLOT_TONE[row.status])}>
                      {row.count}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                      {row.target.min}–{row.target.max}
                    </span>
                  </div>
                </button>
                <div className="px-3 pb-2">
                  <SlotBar row={row} />
                </div>
                {isOpen && (
                  <div className="space-y-1 border-t border-border-subtle bg-surface-inset/30 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                      Owned candidates ·{" "}
                      <span className="text-text-secondary">
                        {row.status === "under"
                          ? `add ${row.target.ideal - row.count}–${row.target.max - row.count} to hit target`
                          : row.status === "over"
                            ? `trim ${row.count - row.target.max}+ to free room for thinner slots`
                            : "in range — additions are optional"}
                      </span>
                    </p>
                    {suggestions.length === 0 ? (
                      <p className="empty-terminal py-2">no owned candidates</p>
                    ) : (
                      <ul className="divide-y divide-border-subtle">
                        {suggestions.slice(0, 10).map((s) => (
                          <SuggestionRow
                            key={s.oracleId}
                            sug={s}
                            addCard={addCard}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

function SlotBar({ row }: { row: SlotRow }) {
  // Bar visualizes count against the slot's max; over-the-max gets a faint
  // overflow tail in brand amber.
  const capped = Math.min(row.count, row.target.max);
  const cappedPct = row.target.max > 0 ? (capped / row.target.max) * 100 : 0;
  const overshoot =
    row.count > row.target.max
      ? Math.min(20, ((row.count - row.target.max) / row.target.max) * 100)
      : 0;
  const idealMark =
    row.target.max > 0 ? (row.target.ideal / row.target.max) * 100 : 50;
  return (
    <div className="relative h-1 rounded-full bg-[var(--surface-inset)]">
      <div
        className={cn("h-full rounded-l-full", SLOT_BAR_TONE[row.status])}
        style={{ width: `${cappedPct}%` }}
      />
      {overshoot > 0 && (
        <div
          className="absolute top-0 h-full bg-[var(--brand)]/40"
          style={{ left: `${cappedPct}%`, width: `${overshoot}%` }}
        />
      )}
      {/* Ideal tick mark */}
      <div
        className="absolute -top-0.5 h-2 w-px bg-[var(--text-muted)]/60"
        style={{ left: `calc(${idealMark}% - 0.5px)` }}
        aria-hidden
      />
    </div>
  );
}

function SuggestionRow({
  sug,
  addCard,
}: {
  sug: SlotSuggestion;
  addCard: (
    printingId: string,
    oracleId: string,
    category?: string,
    delta?: number,
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Basic lands are the only cards you add many of — give them a count input.
  const isBasic = /Basic Land/i.test(sug.typeLine ?? "");
  const [qty, setQty] = useState(1);

  const onAdd = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${sug.oracleId}/detail`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const printing = data.printings?.[0];
      if (!printing) throw new Error("No printings");
      const n = isBasic ? Math.max(1, Math.min(qty, 99)) : 1;
      await addCard(printing.id, sug.oracleId, "main", n);
      toast.success(`Added ${n}× ${sug.name}`);
    } catch (err) {
      toast.error(
        `Could not add: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }, [sug.oracleId, sug.name, addCard, isBasic, qty]);

  return (
    <li className="flex items-center gap-2 py-1.5 text-[12px]">
      {sug.manaCost ? (
        <ManaCost cost={sug.manaCost} size="xs" />
      ) : (
        <span className="inline-block w-4" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
        {sug.name}
      </span>
      {!isBasic && (
        <span className="hidden truncate text-[11px] text-text-muted sm:inline sm:max-w-[120px]">
          {sug.typeLine}
        </span>
      )}
      {sug.edhrecRank != null && !isBasic && (
        <span className="num shrink-0 text-[10px] text-text-muted">
          #{sug.edhrecRank}
        </span>
      )}
      {isBasic && (
        <input
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(e) =>
            setQty(Math.max(1, Math.min(Number(e.target.value) || 1, 99)))
          }
          aria-label={`Quantity of ${sug.name}`}
          className="num h-5 w-11 shrink-0 rounded-sm border border-border-subtle bg-surface-base px-1 text-[11px] text-text-primary outline-none focus:border-brand"
        />
      )}
      <button
        type="button"
        onClick={() => void onAdd()}
        disabled={busy}
        className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-sm border border-border-subtle bg-surface-raised px-1 font-mono text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-2.5 animate-spin" />
        ) : (
          <Plus className="size-2.5" />
        )}
        Add
      </button>
    </li>
  );
}
