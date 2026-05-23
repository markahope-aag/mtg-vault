"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDeckbuilder } from "./shell";
import { Button } from "@/components/ui/button";
import type { DeckAnalysis } from "@/lib/ai/strategy";

type AnalysisResponse = {
  analysis: DeckAnalysis | null;
  model: string | null;
  signature: string | null;
  analyzedAt: string | null;
  currentSignature: string;
  isStale: boolean;
};

export function StrategyPane() {
  const { deck, addCard } = useDeckbuilder();
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The fetch starts immediately on mount / deck change; setLoading here
    // is the intended in-effect trigger.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/decks/${deck.deck.id}/analyze`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AnalysisResponse | null) => {
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
  }, [deck.deck.id]);

  const onAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/decks/${deck.deck.id}/analyze`, {
        method: "POST",
      });
      // The endpoint normally returns JSON, but a platform timeout (Vercel
      // function limit) can substitute an HTML error page. Read the raw text
      // and parse defensively so we surface a clean message either way.
      const text = await res.text();
      let body: { error?: string; analysis?: unknown } | null = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (!res.ok) {
        const hint = !body && res.status >= 500 ? " (the request may have timed out — try again)" : "";
        throw new Error((body?.error ?? `HTTP ${res.status}`) + hint);
      }
      if (!body) throw new Error("Empty response from analyze endpoint");
      setData(body as unknown as AnalysisResponse);
      toast.success("Strategy analysis updated");
    } catch (err) {
      toast.error(
        `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAnalyzing(false);
    }
  }, [deck.deck.id]);

  if (loading) {
    return (
      <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-text-muted">
        <Loader2 className="size-4 animate-spin" />
      </aside>
    );
  }

  const a: DeckAnalysis | null = data?.analysis ?? null;

  return (
    <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-inset/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[var(--brand)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Strategy advisor
          </p>
        </div>
        {a && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAnalyze}
            disabled={analyzing}
            className="h-6 gap-1 px-2 font-mono text-[10px] uppercase tracking-wide"
          >
            {analyzing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Re-analyze
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {a == null || data == null ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <Sparkles className="size-6 text-[var(--brand)] opacity-60" />
            <p className="empty-terminal">no analysis yet</p>
            <p className="max-w-xs text-[12px] text-text-secondary">
              Generate an archetype read, win conditions, gameplan, weaknesses,
              and improvement suggestions drawn from your inventory.
            </p>
            {!deck.commander && (
              <p className="rounded-sm border border-[var(--border-default)] bg-[var(--surface-inset)] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[var(--value-negative)]">
                Set a commander first
              </p>
            )}
            <Button
              onClick={onAnalyze}
              disabled={analyzing || !deck.commander}
              size="sm"
              className="h-7 gap-1.5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" /> Analyze deck
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 p-3">
            {data.isStale && (
              <div className="flex items-start gap-2 rounded-sm border border-[var(--brand)]/40 bg-[var(--brand-soft)]/40 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--brand-strong)]">
                <AlertTriangle className="size-3 shrink-0" />
                <span>
                  Decklist changed since this analysis. Re-analyze for a fresh
                  read.
                </span>
              </div>
            )}

            {/* Archetype */}
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                Archetype
              </p>
              <h3 className="mt-1 font-[var(--font-display)] text-[18px] font-semibold tracking-tight text-text-primary">
                {a.archetype}
              </h3>
              {a.subArchetype && (
                <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--brand)]">
                  {a.subArchetype}
                </p>
              )}
              <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
                {a.summary}
              </p>
            </section>

            {/* Win conditions */}
            <Section title="Win conditions">
              <ol className="space-y-1.5">
                {a.winConditions.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[12px]">
                    <span className="num shrink-0 text-[var(--brand)]">
                      {i + 1}
                    </span>
                    <span className="text-text-secondary">{w}</span>
                  </li>
                ))}
              </ol>
            </Section>

            {/* Gameplan */}
            <Section title="Gameplan">
              <div className="space-y-1.5 text-[12px] leading-relaxed">
                <Phase label="Early" body={a.gameplan.earlyGame} />
                <Phase label="Mid" body={a.gameplan.midGame} />
                <Phase label="Late" body={a.gameplan.lateGame} />
              </div>
            </Section>

            {/* Weaknesses */}
            <Section title="Weaknesses">
              <ul className="space-y-1.5">
                {a.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[12px]">
                    <span className="shrink-0 text-[var(--value-negative)]">
                      ▼
                    </span>
                    <span className="text-text-secondary">{w}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Improvements */}
            <Section title="From your inventory">
              {a.improvements.length === 0 ? (
                <p className="empty-terminal">no suggestions</p>
              ) : (
                <ul className="space-y-2">
                  {a.improvements.map((imp, i) => (
                    <li
                      key={i}
                      className="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 p-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-medium text-text-primary">
                          {imp.cardName}
                        </p>
                        <ImprovementAddButton
                          oracleId={imp.oracleId}
                          onAdded={() => toast.success(`Added ${imp.cardName}`)}
                          addCard={addCard}
                        />
                      </div>
                      {imp.replacesCardName && (
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          swaps with {imp.replacesCardName}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                        {imp.rationale}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Acquisitions */}
            <Section title="Worth acquiring">
              {(a.acquisitions ?? []).length === 0 ? (
                <p className="empty-terminal">no suggestions</p>
              ) : (
                <ul className="space-y-2">
                  {(a.acquisitions ?? []).map((acq, i) => (
                    <li
                      key={i}
                      className="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)]/40 p-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        {acq.oracleId ? (
                          <Link
                            href={`/cards/${acq.oracleId}`}
                            className="text-[13px] font-medium text-text-primary hover:underline"
                          >
                            {acq.cardName}
                          </Link>
                        ) : (
                          <p className="text-[13px] font-medium text-text-primary">
                            {acq.cardName}
                          </p>
                        )}
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-[var(--brand)]">
                          buy
                        </span>
                      </div>
                      {acq.replacesCardName && (
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          swaps with {acq.replacesCardName}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                        {acq.rationale}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {data.analyzedAt && (
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                {data.model} · {new Date(data.analyzedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        {title}
      </p>
      {children}
    </section>
  );
}

function Phase({ label, body }: { label: string; body: string }) {
  return (
    <p className="text-text-secondary">
      <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--brand)]">
        {label}
      </span>{" "}
      <span>{body}</span>
    </p>
  );
}

function ImprovementAddButton({
  oracleId,
  addCard,
  onAdded,
}: {
  oracleId: string;
  addCard: (printingId: string, oracleId: string, category?: string) => Promise<void>;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cards/${oracleId}/detail`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const printing = data.printings?.[0];
      if (!printing) throw new Error("No printings found");
      await addCard(printing.id, oracleId, "main");
      onAdded();
    } catch (err) {
      toast.error(
        `Could not add: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }, [oracleId, addCard, onAdded]);
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
      title="Add to main board"
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Plus className="size-3" />
      )}
      Add
    </button>
  );
}
