"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, Plus, RefreshCw } from "lucide-react";
import { useDeckbuilder } from "./shell";
import { ManaCost } from "@/components/mana-cost";
import { SetSymbol } from "@/components/set-symbol";
import { Button } from "@/components/ui/button";

type Printing = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUri: string | null;
  usd: string | null;
};

type DetailFetch = {
  card: {
    oracleId: string;
    name: string;
    manaCost: string | null;
    typeLine: string | null;
    oracleText: string | null;
    colorIdentity: string[] | null;
    power: string | null;
    toughness: string | null;
    loyalty: string | null;
    edhrecRank: number | null;
    isGameChanger: boolean;
    isMassLandDenial: boolean;
    isExtraTurn: boolean;
    isTutor: boolean;
  };
  printings: Printing[];
  ownership: {
    total: number;
    byPrinting: Array<{
      printingId: string;
      setCode: string;
      setName: string;
      count: number;
      locations: string[];
    }>;
  };
};

const TAG_TONE: Record<
  "Game Changer" | "Mass Land Denial" | "Extra Turn" | "Tutor",
  string
> = {
  "Game Changer":
    "bg-[var(--color-value-negative)]/15 text-[var(--color-value-negative)] border-[var(--color-value-negative)]/30",
  "Mass Land Denial":
    "bg-[var(--color-bracket-3)]/15 text-[var(--color-bracket-3)] border-[var(--color-bracket-3)]/30",
  "Extra Turn":
    "bg-[var(--color-mtg-multicolor)]/15 text-[var(--color-mtg-multicolor)] border-[var(--color-mtg-multicolor)]/30",
  Tutor:
    "bg-[var(--color-mtg-blue)]/15 text-[var(--color-mtg-blue)] border-[var(--color-mtg-blue)]/30",
};

export function DetailPane() {
  const { deck, active, addCard, moveCard, swapPrinting } = useDeckbuilder();
  const [detail, setDetail] = useState<DetailFetch | null>(null);
  const [loading, setLoading] = useState(false);

  const oracleId = active?.oracleId ?? deck.commander?.oracleId ?? null;

  useEffect(() => {
    if (!oracleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/cards/${oracleId}/detail`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => setDetail(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oracleId]);

  if (!oracleId) {
    return (
      <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-raised px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Card detail
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          Select a card to inspect.
        </p>
      </aside>
    );
  }

  const headerName = detail?.card.name ?? active?.name ?? deck.commander?.name;
  const headerType = detail?.card.typeLine ?? active?.typeLine;
  const headerMana = detail?.card.manaCost ?? active?.manaCost;
  const oracleText = detail?.card.oracleText ?? active?.oracleText;
  const headerImage =
    detail?.printings[0]?.imageUri ??
    active?.imageUri ??
    (deck.commander?.printing.imageUris?.normal as string | undefined) ??
    null;

  const tags: Array<{ label: keyof typeof TAG_TONE }> = [];
  if (detail?.card.isGameChanger) tags.push({ label: "Game Changer" });
  if (detail?.card.isMassLandDenial) tags.push({ label: "Mass Land Denial" });
  if (detail?.card.isExtraTurn) tags.push({ label: "Extra Turn" });
  if (detail?.card.isTutor) tags.push({ label: "Tutor" });

  const inDeck = deck.cards.find((c) => c.card.oracleId === oracleId);
  const isCommander = deck.commander?.oracleId === oracleId;
  const isPartner = deck.partner?.oracleId === oracleId;
  const isInDeck = !!inDeck || isCommander || isPartner;

  return (
    <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
      {isInDeck && (
        <div className="shrink-0 border-b border-border-subtle bg-[var(--color-brand-soft)]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-brand-strong)]">
          <span className="inline-block size-1.5 rounded-full bg-brand align-middle" />
          <span className="ml-2">
            {isCommander
              ? "in deck · commander"
              : isPartner
                ? "in deck · partner"
                : `in deck · ${inDeck?.deckCardRow.category}`}
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3">
          {headerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerImage}
              alt={headerName ?? ""}
              className="aspect-[488/680] w-full rounded-md object-cover ring-1 ring-border-subtle"
            />
          ) : (
            <div className="flex aspect-[488/680] w-full items-center justify-center rounded-md bg-surface-inset text-text-muted ring-1 ring-border-subtle">
              <ImageOff className="size-10" />
            </div>
          )}
        </div>

        <div className="space-y-3 px-3 pb-3">
          <div>
            <h3 className="flex flex-wrap items-baseline gap-2 text-[15px] font-semibold leading-tight text-text-primary">
              <span className="truncate">{headerName}</span>
              <ManaCost cost={headerMana} size="sm" />
            </h3>
            {headerType && (
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-text-muted">
                {headerType}
              </p>
            )}
          </div>

          {oracleText && (
            <div className="space-y-1 border-l-2 border-border-subtle pl-3 text-xs leading-relaxed text-text-secondary">
              {oracleText.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {(detail?.card.loyalty ||
            (detail?.card.power && detail?.card.toughness) ||
            detail?.card.edhrecRank != null) && (
            <div className="flex items-center gap-4 font-mono text-[11px]">
              {detail?.card.loyalty && (
                <span className="text-text-primary">
                  <span className="text-text-muted">L</span>{" "}
                  {detail.card.loyalty}
                </span>
              )}
              {detail?.card.power && detail?.card.toughness && (
                <span className="text-text-primary">
                  {detail.card.power}/{detail.card.toughness}
                </span>
              )}
              {detail?.card.edhrecRank != null && (
                <span className="text-text-muted">
                  EDHREC <span className="text-text-primary">#{detail.card.edhrecRank}</span>
                </span>
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t.label}
                  className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${TAG_TONE[t.label]}`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}

          {detail?.ownership && (
            <section className="space-y-1.5">
              <header className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Inventory
                </p>
                <p className="font-mono text-[11px] tabular-nums text-text-primary">
                  {detail.ownership.total}
                  <span className="ml-1 text-text-muted">
                    across {detail.ownership.byPrinting.length}
                  </span>
                </p>
              </header>
              {detail.ownership.byPrinting.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border-subtle bg-surface-inset/40 px-2 py-1.5 text-[11px] text-text-muted">
                  None owned.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-sm border border-border-subtle bg-surface-inset/40">
                  {detail.ownership.byPrinting.map((p) => {
                    const swappable =
                      inDeck && inDeck.deckCardRow.printingId !== p.printingId;
                    return (
                      <li
                        key={p.printingId}
                        className="group/own flex items-center gap-2 px-2 py-1.5 text-[11px]"
                      >
                        <SetSymbol setCode={p.setCode} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-text-primary">
                          {p.setName}
                        </span>
                        <span className="font-mono tabular-nums text-text-primary">
                          ×{p.count}
                        </span>
                        {p.locations.length > 0 && (
                          <span className="font-mono text-text-muted">
                            · {p.locations[0]}
                            {p.locations.length > 1 &&
                              ` +${p.locations.length - 1}`}
                          </span>
                        )}
                        {swappable && (
                          <button
                            type="button"
                            onClick={() =>
                              void swapPrinting(
                                inDeck.deckCardRow.printingId,
                                p.printingId,
                                inDeck.card.oracleId,
                                inDeck.deckCardRow.category,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-sm border border-transparent px-1 font-mono text-[10px] uppercase tracking-wide text-text-muted opacity-0 transition-opacity hover:border-border-subtle hover:text-text-primary group-hover/own:opacity-100"
                            title="Use this printing in the deck"
                          >
                            <RefreshCw className="size-3" />
                            Swap
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            {!isCommander && !isPartner && (
              <>
                {inDeck ? (
                  <select
                    value={inDeck.deckCardRow.category}
                    onChange={(e) =>
                      void moveCard(
                        inDeck.deckCardRow.printingId,
                        inDeck.deckCardRow.category,
                        e.target.value,
                      )
                    }
                    className="rounded-sm border border-border-subtle bg-surface-base px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-primary"
                  >
                    <option value="main">In · Main</option>
                    <option value="maybeboard">In · Maybeboard</option>
                    <option value="considering">In · Considering</option>
                  </select>
                ) : (
                  detail?.printings[0] && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void addCard(detail.printings[0].id, oracleId, "main")
                      }
                    >
                      <Plus className="size-3.5" /> Add to main
                    </Button>
                  )
                )}
              </>
            )}
            <Link
              href={`/cards/${oracleId}`}
              className="ml-auto font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
            >
              Full detail →
            </Link>
          </div>

          {loading && (
            <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
              Loading…
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
