"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReconcileResult } from "@/lib/rogue/reconcile";
import {
  RogueVerdict,
  type RogueCritique,
  type RogueRationale,
} from "./rogue-verdict";
import { IteratePanel } from "./iterate-panel";

type ProposalRow = {
  id: string;
  kind: string;
  commanderOracleId: string | null;
  targetBracket: number | null;
  archetypeBrief: string | null;
  status: string;
  cardList: unknown;
  analysis: unknown;
  rogueRationale: unknown;
  critique: unknown;
  generationLog: unknown;
  savedDeckId: string | null;
  // Phase 3 — fork lineage (nullable for non-iterated proposals).
  parentProposalId?: string | null;
  iterateInstruction?: string | null;
};

type Card = {
  oracleId: string;
  name: string;
  role?: string;
  rationale?: string;
  isLand?: boolean;
};

type Analysis = {
  archetype: string;
  subArchetype: string | null;
  summary: string;
  winConditions: string[];
  gameplan: { earlyGame: string; midGame: string; lateGame: string };
  weaknesses: string[];
};

const BUCKET_TONE: Record<string, string> = {
  available_now: "text-[var(--value-positive)]",
  movable: "text-amber-500",
  contested: "text-[var(--color-bracket-3)]",
  must_buy: "text-[var(--value-negative)]",
};

export function ProposalView({
  proposalId,
  initial,
}: {
  proposalId: string;
  initial: ProposalRow;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(
    Array.isArray(initial.cardList) ? (initial.cardList as Card[]) : [],
  );
  const [reconcileData, setReconcileData] = useState<ReconcileResult | null>(
    null,
  );
  const [reconciling, setReconciling] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [saving, setSaving] = useState(false);
  const violations = useMemo<
    Array<{ type: string; cardName: string; detail: string }>
  >(() => {
    const log = initial.generationLog as
      | { finalViolations?: Array<{ type: string; cardName: string; detail: string }> }
      | null;
    return log?.finalViolations ?? [];
  }, [initial.generationLog]);

  const analysis = (initial.analysis ?? null) as Analysis | null;
  const rogueRationale = (initial.rogueRationale ?? null) as
    | RogueRationale
    | null;
  const critique = (initial.critique ?? null) as RogueCritique | null;
  const isRogue = initial.kind === "rogue" && rogueRationale && critique;

  // Run reconciliation on mount + whenever cards change. The pipeline
  // already wrote the proposal's cardList; the reconcile endpoint reads
  // from there, so a PATCH first then re-fetch is the right order if the
  // user edits.
  const refreshReconcile = useCallback(async () => {
    setReconciling(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/reconcile`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ReconcileResult;
      setReconcileData(data);
    } catch (err) {
      toast.error(
        `Reconcile failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setReconciling(false);
    }
  }, [proposalId]);

  useEffect(() => {
    // refreshReconcile sets state on the fetch callback (intentional —
    // we're synchronizing with the server). Lint flags the indirect
    // setState path; suppress narrowly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshReconcile();
  }, [refreshReconcile]);

  const bucketByOracle = useMemo(() => {
    const map = new Map<string, string>();
    if (!reconcileData) return map;
    for (const [bucket, list] of Object.entries(reconcileData.buckets)) {
      for (const c of list) map.set(c.oracleId, bucket);
    }
    return map;
  }, [reconcileData]);

  // Group cards by type prefix (Creatures / Instants / Lands / etc.) so the
  // editable decklist reads like a normal Commander list.
  const grouped = useMemo(() => {
    const buckets = new Map<string, Card[]>();
    for (const c of cards) {
      const key = c.isLand ? "Lands" : (c.role ?? "Other").toUpperCase();
      const existing = buckets.get(key) ?? [];
      existing.push(c);
      buckets.set(key, existing);
    }
    const order = [
      "WINCON",
      "SYNERGY",
      "RAMP",
      "DRAW",
      "REMOVAL",
      "INTERACTION",
      "UTILITY",
      "OTHER",
      "Lands",
    ];
    return order
      .map((k) => ({ key: k, cards: buckets.get(k) ?? [] }))
      .filter((g) => g.cards.length > 0)
      .concat(
        [...buckets.entries()]
          .filter(([k]) => !order.includes(k))
          .map(([k, v]) => ({ key: k, cards: v })),
      );
  }, [cards]);

  const removeCard = useCallback(
    (oracleId: string) => {
      const next = cards.filter((c) => c.oracleId !== oracleId);
      setCards(next);
      void fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardList: next }),
      }).then(() => refreshReconcile());
    },
    [cards, proposalId, refreshReconcile],
  );

  const onSave = useCallback(() => {
    const name = deckName.trim();
    if (!name) {
      toast.error("Give the deck a name first.");
      return;
    }
    confirmToast(`Save "${name}" as a real deck?`, {
      description:
        "This commits the current draft to your deck list. You can keep editing in the deckbuilder afterward.",
      confirmLabel: "Save",
      onConfirm: async () => {
        setSaving(true);
        try {
          const res = await fetch(`/api/proposals/${proposalId}/save`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
          toast.success("Saved");
          router.push(`/decks/${body.deckId}`);
        } catch (err) {
          toast.error(
            `Save failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          setSaving(false);
        }
      },
    });
  }, [deckName, proposalId, router]);

  // If the proposal was already saved as a real deck, link to it instead of
  // re-rendering an editable view.
  if (initial.savedDeckId) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-sm">
          <p className="font-medium">This proposal has been saved.</p>
          <Link
            href={`/decks/${initial.savedDeckId}`}
            className="text-[var(--brand)] hover:underline"
          >
            Open the deck →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Draft proposal
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {cards.length} cards · bracket {initial.targetBracket ?? "—"} ·{" "}
            {initial.kind} generator
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Deck name"
            className="w-48"
          />
          <Button onClick={onSave} disabled={saving || cards.length === 0}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save as deck"}
          </Button>
        </div>
      </header>

      {initial.parentProposalId && (
        <div className="rounded-md border border-border-subtle bg-surface-inset/40 px-3 py-2 text-xs">
          <span className="font-mono uppercase text-text-muted">
            Iterated from
          </span>{" "}
          <Link
            href={`/decks/new/generate/${initial.parentProposalId}`}
            className="text-text-primary hover:underline"
          >
            parent proposal
          </Link>
          {initial.iterateInstruction && (
            <span className="text-text-muted">
              {" "}
              · &ldquo;{initial.iterateInstruction}&rdquo;
            </span>
          )}
        </div>
      )}

      <IteratePanel
        proposalId={proposalId}
        currentTarget={initial.targetBracket}
      />

      {isRogue && rogueRationale && critique && (
        <RogueVerdict rationale={rogueRationale} critique={critique} />
      )}

      {violations.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Remaining validator notes ({violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-text-secondary">
            <p className="mb-2">
              The repair loop didn&rsquo;t resolve these. You can swap the
              cards inline or save anyway — the deckbuilder accepts the deck
              either way.
            </p>
            <ul className="space-y-0.5">
              {violations.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{v.cardName}</span>{" "}
                  <span className="font-mono text-text-muted">
                    [{v.type}]
                  </span>{" "}
                  — {v.detail}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Decklist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Decklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {grouped.map((g) => (
              <div key={g.key}>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                  {g.key}{" "}
                  <span className="font-normal">({g.cards.length})</span>
                </p>
                <ul className="space-y-0.5">
                  {g.cards.map((c) => {
                    const bucket = bucketByOracle.get(c.oracleId);
                    return (
                      <li
                        key={`${c.oracleId}-${c.name}`}
                        className="group/row flex items-center gap-2 rounded-sm px-2 py-1 text-[13px] hover:bg-surface-inset/60"
                      >
                        <span
                          className={cn(
                            "inline-block size-1.5 shrink-0 rounded-full",
                            bucket
                              ? BUCKET_TONE[bucket]
                              : "text-text-muted/40",
                          )}
                          style={{
                            background: "currentColor",
                          }}
                          title={bucket}
                        />
                        <Link
                          href={`/cards/${c.oracleId}`}
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.rationale && (
                          <span className="hidden truncate text-[11px] text-text-muted sm:inline sm:max-w-[200px]">
                            {c.rationale}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCard(c.oracleId)}
                          // Same reveal pattern as the deckbuilder
                          // decklist: visible on hover (mouse),
                          // focus-within / focus-visible (keyboard),
                          // and unconditionally on touch
                          // ([@media(hover:none)]) where there's no
                          // hover state at all. 44x44 hit area on
                          // touch matches the iOS minimum tap target;
                          // mouse users keep the compact icon.
                          className="invisible inline-flex size-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)] focus-visible:visible focus-visible:text-[var(--value-negative)] group-hover/row:visible group-focus-within/row:visible [@media(hover:none)]:visible [@media(hover:none)]:size-9"
                          aria-label={`Remove ${c.name}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right rail: reconcile + analysis */}
        <div className="space-y-4">
          {reconcileData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Reconciliation
                  {reconciling && (
                    <span className="ml-2 text-[11px] text-text-muted">
                      refreshing…
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="space-y-0.5 font-mono uppercase">
                  <p>
                    <span className="text-text-muted">Available </span>
                    <span className="tabular-nums text-[var(--value-positive)]">
                      {reconcileData.summary.ownedUnassigned}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-muted">Movable </span>
                    <span className="tabular-nums text-amber-500">
                      {reconcileData.summary.movableCount}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-muted">Must buy </span>
                    <span className="tabular-nums text-[var(--value-negative)]">
                      {reconcileData.summary.mustBuyCount}
                    </span>
                  </p>
                  <p className="pt-1">
                    <span className="text-text-muted">Cheapest completion </span>
                    <span className="font-semibold tabular-nums">
                      ${reconcileData.summary.cheapestCompletionUsd.toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="space-y-1 border-t border-border-subtle pt-2">
                  {Object.values(reconcileData.scenarios).map((s) => (
                    <div
                      key={s.key}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="text-text-secondary">{s.label}</span>
                      <span className="font-mono tabular-nums">
                        ${s.totalCostUsd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Archetype
                  </p>
                  <p className="font-medium">
                    {analysis.archetype}
                    {analysis.subArchetype && (
                      <span className="font-normal text-text-muted">
                        {" "}
                        · {analysis.subArchetype}
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-text-secondary">{analysis.summary}</p>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Win conditions
                  </p>
                  <ul className="ml-3 list-disc space-y-0.5">
                    {analysis.winConditions.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Gameplan
                  </p>
                  <p>
                    <span className="font-medium">Early.</span>{" "}
                    {analysis.gameplan.earlyGame}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Mid.</span>{" "}
                    {analysis.gameplan.midGame}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Late.</span>{" "}
                    {analysis.gameplan.lateGame}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Weaknesses
                  </p>
                  <ul className="ml-3 list-disc space-y-0.5">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

