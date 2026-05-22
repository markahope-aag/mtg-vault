"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useDeckbuilder } from "./shell";
import { SetSymbol } from "@/components/set-symbol";
import { ManaCost } from "@/components/mana-cost";
import { BASIC_LAND_NAMES } from "@/lib/curated/any-number-allowed";

function priceOf(usd: string | null | undefined): number {
  if (!usd) return 0;
  const n = Number.parseFloat(usd);
  return Number.isFinite(n) ? n : 0;
}

type AcquireItem = {
  key: string;
  oracleId: string;
  name: string;
  manaCost: string | null;
  setCode: string;
  needed: number;
  owned: number;
  shortfall: number;
  unitPrice: number;
};

/**
 * Rolls up every card in the deck the player doesn't own enough copies of
 * (basic lands excluded — those are free) into a shopping list with a total
 * cost to build. Ownership comes from the availability map.
 */
export function AcquirePane() {
  const { deck, availability } = useDeckbuilder();

  const items = useMemo(() => {
    const out: AcquireItem[] = [];
    const consider = (
      oracleId: string,
      name: string,
      manaCost: string | null,
      setCode: string,
      usd: string | null | undefined,
      needed: number,
      keySuffix: string,
    ) => {
      if (BASIC_LAND_NAMES.has(name)) return;
      const owned = availability[oracleId]?.owned ?? 0;
      const shortfall = Math.max(0, needed - owned);
      if (shortfall === 0) return;
      out.push({
        key: `${oracleId}${keySuffix}`,
        oracleId,
        name,
        manaCost,
        setCode,
        needed,
        owned,
        shortfall,
        unitPrice: priceOf(usd),
      });
    };

    if (deck.commander) {
      consider(
        deck.commander.oracleId,
        deck.commander.name,
        deck.commander.manaCost,
        deck.commander.printing.setCode,
        deck.commander.printing.usd,
        1,
        "-cmd",
      );
    }
    if (deck.partner) {
      consider(
        deck.partner.oracleId,
        deck.partner.name,
        deck.partner.manaCost,
        deck.partner.printing.setCode,
        deck.partner.printing.usd,
        1,
        "-pa",
      );
    }
    for (const c of deck.cards) {
      consider(
        c.card.oracleId,
        c.card.name,
        c.card.manaCost,
        c.printing.setCode,
        c.printing.usd,
        c.deckCardRow.quantity,
        `-${c.deckCardRow.printingId}-${c.deckCardRow.category}`,
      );
    }
    return out.sort(
      (a, b) => b.unitPrice * b.shortfall - a.unitPrice * a.shortfall,
    );
  }, [deck, availability]);

  const total = items.reduce((s, i) => s + i.unitPrice * i.shortfall, 0);
  const cardCount = items.reduce((s, i) => s + i.shortfall, 0);
  const unpriced = items.some((i) => i.unitPrice === 0);

  return (
    <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-inset/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-3.5 text-[var(--brand)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
            To acquire
          </p>
        </div>
        {items.length > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            <span className="num text-text-primary">{cardCount}</span> card
            {cardCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <ShoppingCart className="size-6 text-[var(--value-positive)] opacity-60" />
          <p className="empty-terminal">collection complete</p>
          <p className="max-w-xs text-[12px] text-text-secondary">
            You own every non-basic card in this deck.
          </p>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-border-subtle px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Cost to build
            </p>
            <p className="num text-[24px] font-semibold leading-tight text-text-primary">
              ${total.toFixed(2)}
            </p>
            {unpriced && (
              <p className="font-mono text-[10px] text-text-muted">
                some cards have no price data
              </p>
            )}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border-subtle overflow-y-auto">
            {items.map((i) => (
              <li
                key={i.key}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px]"
              >
                <SetSymbol setCode={i.setCode} size="sm" />
                {i.manaCost ? (
                  <ManaCost cost={i.manaCost} size="xs" />
                ) : (
                  <span className="inline-block w-3" />
                )}
                <Link
                  href={`/cards/${i.oracleId}`}
                  className="min-w-0 flex-1 truncate font-medium text-text-primary hover:underline"
                >
                  {i.name}
                </Link>
                {i.shortfall > 1 && (
                  <span className="num shrink-0 text-[10px] text-text-muted">
                    ×{i.shortfall}
                  </span>
                )}
                <span className="num shrink-0 text-text-secondary">
                  {i.unitPrice > 0 ? `$${i.unitPrice.toFixed(2)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
