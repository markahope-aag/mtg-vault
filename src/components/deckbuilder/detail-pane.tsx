"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import { useDeckbuilder } from "./shell";
import { ManaCost } from "@/components/mana-cost";
import { Badge } from "@/components/ui/badge";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <aside className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Click a card to see details.
      </aside>
    );
  }

  // Fall back to the active stub if the detail fetch hasn't finished
  const headerName = detail?.card.name ?? active?.name ?? deck.commander?.name;
  const headerType = detail?.card.typeLine ?? active?.typeLine;
  const headerMana = detail?.card.manaCost ?? active?.manaCost;
  const oracleText = detail?.card.oracleText ?? active?.oracleText;
  const headerImage =
    detail?.printings[0]?.imageUri ??
    active?.imageUri ??
    (deck.commander?.printing.imageUris?.normal as string | undefined) ??
    null;

  const tags: Array<{ label: string; tone: string }> = [];
  if (detail?.card.isGameChanger)
    tags.push({ label: "Game Changer", tone: "bg-rose-100 text-rose-900" });
  if (detail?.card.isMassLandDenial)
    tags.push({ label: "Mass Land Denial", tone: "bg-amber-100 text-amber-900" });
  if (detail?.card.isExtraTurn)
    tags.push({ label: "Extra Turn", tone: "bg-purple-100 text-purple-900" });
  if (detail?.card.isTutor)
    tags.push({ label: "Tutor", tone: "bg-sky-100 text-sky-900" });

  const inDeck = deck.cards.find((c) => c.card.oracleId === oracleId);
  const isCommander = deck.commander?.oracleId === oracleId;
  const isPartner = deck.partner?.oracleId === oracleId;

  return (
    <aside className="flex h-full max-h-[calc(100vh-160px)] flex-col overflow-hidden rounded-lg border bg-card">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerImage}
            alt={headerName ?? ""}
            className="aspect-[488/680] w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="flex aspect-[488/680] w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <ImageOff className="size-10" />
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight">
            {headerName}
            <span className="ml-2 align-middle">
              <ManaCost cost={headerMana} size="sm" />
            </span>
          </h3>
          {headerType && (
            <p className="text-xs text-muted-foreground">{headerType}</p>
          )}
        </div>

        {oracleText && (
          <div className="space-y-1 text-xs leading-relaxed text-foreground/90">
            {oracleText.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {detail?.card.loyalty && (
          <p className="text-sm font-semibold">Loyalty {detail.card.loyalty}</p>
        )}
        {detail?.card.power && detail?.card.toughness && (
          <p className="text-sm font-semibold">
            {detail.card.power}/{detail.card.toughness}
          </p>
        )}
        {detail?.card.edhrecRank != null && (
          <p className="text-xs text-muted-foreground">
            EDHREC rank #{detail.card.edhrecRank}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t.label}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.tone}`}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}

        {detail?.ownership && (
          <div className="space-y-1.5 rounded border bg-muted/30 p-2 text-xs">
            <p className="font-medium">
              Owned: {detail.ownership.total} across{" "}
              {detail.ownership.byPrinting.length} printing
              {detail.ownership.byPrinting.length === 1 ? "" : "s"}.
            </p>
            {detail.ownership.byPrinting.length > 0 && (
              <ul className="space-y-1">
                {detail.ownership.byPrinting.map((p) => (
                  <li
                    key={p.printingId}
                    className="flex flex-wrap items-center gap-1 text-[11px]"
                  >
                    <span className="font-medium">×{p.count}</span>
                    <span>{p.setName}</span>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {p.setCode}
                    </Badge>
                    {inDeck &&
                      inDeck.deckCardRow.printingId !== p.printingId && (
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
                          className="ml-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Use this printing
                        </button>
                      )}
                    {p.locations.length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        {p.locations.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
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
                  className="rounded border border-input bg-card px-2 py-1 text-xs"
                >
                  <option value="main">In: Main</option>
                  <option value="maybeboard">In: Maybeboard</option>
                  <option value="considering">In: Considering</option>
                </select>
              ) : (
                detail?.printings[0] && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void addCard(detail.printings[0].id, oracleId, "main")
                    }
                  >
                    <Plus className="size-4" /> Add to main
                  </Button>
                )
              )}
            </>
          )}
          <Link
            href={`/cards/${oracleId}`}
            target="_blank"
            rel="noopener"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open full detail →
          </Link>
        </div>

        {loading && (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        )}
      </div>
    </aside>
  );
}
