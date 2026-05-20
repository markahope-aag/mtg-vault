"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useDeckbuilder } from "./shell";
import { ManaCost } from "@/components/mana-cost";
import {
  TYPE_GROUP_ORDER,
  typeGroupOf,
  type DeckCard,
  type DeckCommander,
} from "@/lib/decks/types";
import {
  ANY_NUMBER_ALLOWED_NAMES,
  BASIC_LAND_NAMES,
} from "@/lib/curated/any-number-allowed";

const CATEGORY_ORDER = ["main", "maybeboard", "considering"] as const;

export function Decklist() {
  const { deck, availability, setActive, removeCard, moveCard } =
    useDeckbuilder();

  const mainCards = deck.cards.filter(
    (c) => c.deckCardRow.category === "main",
  );
  const maybeboard = deck.cards.filter(
    (c) => c.deckCardRow.category === "maybeboard",
  );
  const considering = deck.cards.filter(
    (c) => c.deckCardRow.category === "considering",
  );

  // Group main cards by type
  const mainGroups = useMemo(() => {
    const map = new Map<string, DeckCard[]>();
    for (const c of mainCards) {
      const g = typeGroupOf(c.card.typeLine);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.card.name.localeCompare(b.card.name));
    return TYPE_GROUP_ORDER.map((group) => ({
      group,
      cards: map.get(group) ?? [],
    })).filter((g) => g.cards.length > 0);
  }, [mainCards]);

  const colorIdentity = new Set(deck.colorIdentity);
  const outOfCI = deck.cards.filter((c) =>
    (c.card.colorIdentity ?? []).some((color) => !colorIdentity.has(color)),
  );
  const singletonViolations = mainCards.filter((c) => {
    if (c.deckCardRow.quantity <= 1) return false;
    if (BASIC_LAND_NAMES.has(c.card.name)) return false;
    if (ANY_NUMBER_ALLOWED_NAMES.has(c.card.name)) return false;
    return true;
  });

  const curve = useMemo(() => computeManaCurve(mainCards), [mainCards]);

  return (
    <section className="flex h-full max-h-[calc(100vh-160px)] flex-col gap-3 overflow-hidden rounded-lg border bg-card">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* Commander */}
        {deck.commander && (
          <CommanderRow commander={deck.commander} label="Commander" />
        )}
        {deck.partner && (
          <CommanderRow commander={deck.partner} label="Partner" />
        )}

        {/* Main */}
        {mainGroups.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
            Add cards from the left pane or via the search.
          </p>
        ) : (
          mainGroups.map((g) => (
            <div key={g.group}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.group}{" "}
                <span className="font-normal">({groupCount(g.cards)})</span>
              </h3>
              <ul className="space-y-0.5">
                {g.cards.map((c) => (
                  <Row
                    key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                    card={c}
                    availability={availability[c.card.oracleId]}
                    onActivate={() =>
                      setActive({
                        oracleId: c.card.oracleId,
                        name: c.card.name,
                        manaCost: c.card.manaCost,
                        typeLine: c.card.typeLine,
                        oracleText: c.card.oracleText,
                        colorIdentity: c.card.colorIdentity,
                        keywords: c.card.keywords,
                        imageUri:
                          (c.printing.imageUris?.small as string | undefined) ??
                          null,
                        inDeck: {
                          printingId: c.deckCardRow.printingId,
                          category: c.deckCardRow.category,
                        },
                      })
                    }
                    onRemove={() =>
                      void removeCard(
                        c.deckCardRow.printingId,
                        c.deckCardRow.category,
                      )
                    }
                    onMove={(toCategory) =>
                      void moveCard(
                        c.deckCardRow.printingId,
                        c.deckCardRow.category,
                        toCategory,
                      )
                    }
                    inCi={colorIdentity}
                  />
                ))}
              </ul>
            </div>
          ))
        )}

        {maybeboard.length > 0 && (
          <details open>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Maybeboard ({groupCount(maybeboard)})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {maybeboard.map((c) => (
                <Row
                  key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                  card={c}
                  availability={availability[c.card.oracleId]}
                  onActivate={() =>
                    setActive({
                      oracleId: c.card.oracleId,
                      name: c.card.name,
                      manaCost: c.card.manaCost,
                      typeLine: c.card.typeLine,
                      oracleText: c.card.oracleText,
                      colorIdentity: c.card.colorIdentity,
                      keywords: c.card.keywords,
                      imageUri:
                        (c.printing.imageUris?.small as string | undefined) ??
                        null,
                      inDeck: {
                        printingId: c.deckCardRow.printingId,
                        category: c.deckCardRow.category,
                      },
                    })
                  }
                  onRemove={() =>
                    void removeCard(
                      c.deckCardRow.printingId,
                      c.deckCardRow.category,
                    )
                  }
                  onMove={(toCategory) =>
                    void moveCard(
                      c.deckCardRow.printingId,
                      c.deckCardRow.category,
                      toCategory,
                    )
                  }
                  inCi={colorIdentity}
                />
              ))}
            </ul>
          </details>
        )}

        {considering.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Considering ({groupCount(considering)})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {considering.map((c) => (
                <Row
                  key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                  card={c}
                  availability={availability[c.card.oracleId]}
                  onActivate={() =>
                    setActive({
                      oracleId: c.card.oracleId,
                      name: c.card.name,
                      manaCost: c.card.manaCost,
                      typeLine: c.card.typeLine,
                      oracleText: c.card.oracleText,
                      colorIdentity: c.card.colorIdentity,
                      keywords: c.card.keywords,
                      imageUri:
                        (c.printing.imageUris?.small as string | undefined) ??
                        null,
                      inDeck: {
                        printingId: c.deckCardRow.printingId,
                        category: c.deckCardRow.category,
                      },
                    })
                  }
                  onRemove={() =>
                    void removeCard(
                      c.deckCardRow.printingId,
                      c.deckCardRow.category,
                    )
                  }
                  onMove={(toCategory) =>
                    void moveCard(
                      c.deckCardRow.printingId,
                      c.deckCardRow.category,
                      toCategory,
                    )
                  }
                  inCi={colorIdentity}
                />
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Validation + curve */}
      <div className="space-y-2 border-t bg-muted/20 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Counter
            label="Cards"
            value={`${deck.totalCards}/100`}
            tone={
              deck.totalCards === 100
                ? "green"
                : deck.totalCards > 100
                  ? "red"
                  : "amber"
            }
          />
          {outOfCI.length > 0 && (
            <span
              className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900"
              title={outOfCI.map((c) => c.card.name).join(", ")}
            >
              {outOfCI.length} outside color identity
            </span>
          )}
          {singletonViolations.length > 0 && (
            <span
              className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-900"
              title={singletonViolations
                .map((c) => `${c.card.name} (×${c.deckCardRow.quantity})`)
                .join(", ")}
            >
              {singletonViolations.length} singleton violation
              {singletonViolations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ManaCurve curve={curve} />
      </div>
    </section>
  );
}

function groupCount(cards: DeckCard[]): number {
  return cards.reduce((s, c) => s + c.deckCardRow.quantity, 0);
}

function CommanderRow({
  commander,
  label,
}: {
  commander: DeckCommander;
  label: string;
}) {
  return (
    <div className="mb-1">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <div className="flex items-center gap-2 rounded border bg-muted/40 p-1.5">
        <Thumb
          src={
            (commander.printing.imageUris?.small as string | undefined) ?? null
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{commander.name}</span>
            <ManaCost cost={commander.manaCost} size="xs" />
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {commander.typeLine}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  card,
  availability,
  inCi,
  onActivate,
  onRemove,
  onMove,
}: {
  card: DeckCard;
  availability:
    | { owned: number; available: number; committedExcluding: number }
    | undefined;
  inCi: Set<string>;
  onActivate: () => void;
  onRemove: () => void;
  onMove: (toCategory: string) => void;
}) {
  const own = availability?.owned ?? 0;
  const avail = availability?.available ?? 0;
  let dot = "bg-rose-500";
  let dotTitle = "Not owned";
  if (own > 0 && avail > 0) {
    dot = "bg-emerald-500";
    dotTitle = `Owned (${avail} available)`;
  } else if (own > 0) {
    dot = "bg-amber-500";
    dotTitle = `Owned but committed elsewhere (${own} total)`;
  }
  const outOfCI = (card.card.colorIdentity ?? []).some(
    (c) => !inCi.has(c) && inCi.size > 0,
  );

  return (
    <li className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50">
      <span
        className={`inline-block size-2 shrink-0 rounded-full ${dot}`}
        title={dotTitle}
      />
      <button
        type="button"
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            e.preventDefault();
            onRemove();
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {card.deckCardRow.quantity}×
        </span>
        <span className="truncate">{card.card.name}</span>
        <ManaCost cost={card.card.manaCost} size="xs" />
        {outOfCI && (
          <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-900">
            OUT
          </span>
        )}
      </button>
      <select
        value={card.deckCardRow.category}
        onChange={(e) => onMove(e.target.value)}
        className="rounded border border-input bg-card text-[10px]"
      >
        {CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label="Remove"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src)
    return (
      <div className="size-8 shrink-0 rounded bg-muted text-muted-foreground" />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-8 shrink-0 rounded object-cover"
      loading="lazy"
    />
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  const cls =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-rose-700"
        : "text-amber-700";
  return (
    <span className={`text-xs font-semibold tabular-nums ${cls}`}>
      {value}
      <span className="ml-1 text-[10px] font-normal uppercase text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

type CurveBucket = { label: string; count: number };
function computeManaCurve(cards: DeckCard[]): CurveBucket[] {
  const buckets: CurveBucket[] = [
    { label: "0", count: 0 },
    { label: "1", count: 0 },
    { label: "2", count: 0 },
    { label: "3", count: 0 },
    { label: "4", count: 0 },
    { label: "5", count: 0 },
    { label: "6", count: 0 },
    { label: "7+", count: 0 },
  ];
  for (const c of cards) {
    if (/\bLand\b/.test(c.card.typeLine ?? "")) continue;
    const cmc = c.card.cmc ? Math.floor(Number.parseFloat(c.card.cmc)) : 0;
    const idx = cmc >= 7 ? 7 : cmc;
    buckets[idx].count += c.deckCardRow.quantity;
  }
  return buckets;
}

function ManaCurve({ curve }: { curve: CurveBucket[] }) {
  const max = Math.max(1, ...curve.map((b) => b.count));
  return (
    <div className="flex items-end gap-1 text-[10px] text-muted-foreground">
      <span className="mr-1">Curve:</span>
      {curve.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-0.5">
          <span className="tabular-nums">{b.count}</span>
          <div
            className="w-4 rounded-t bg-foreground/30"
            style={{ height: `${Math.round((b.count / max) * 28) + 2}px` }}
          />
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  );
}
