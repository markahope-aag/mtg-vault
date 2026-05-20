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
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = ["main", "maybeboard", "considering"] as const;

export function Decklist() {
  const {
    deck,
    availability,
    active,
    setActive,
    removeCard,
    moveCard,
  } = useDeckbuilder();

  const mainCards = deck.cards.filter(
    (c) => c.deckCardRow.category === "main",
  );
  const maybeboard = deck.cards.filter(
    (c) => c.deckCardRow.category === "maybeboard",
  );
  const considering = deck.cards.filter(
    (c) => c.deckCardRow.category === "considering",
  );

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
  const activeOracleId = active?.oracleId ?? null;

  const rowProps = (c: DeckCard) => ({
    card: c,
    availability: availability[c.card.oracleId],
    isActive: activeOracleId === c.card.oracleId,
    onActivate: () =>
      setActive({
        oracleId: c.card.oracleId,
        name: c.card.name,
        manaCost: c.card.manaCost,
        typeLine: c.card.typeLine,
        oracleText: c.card.oracleText,
        colorIdentity: c.card.colorIdentity,
        keywords: c.card.keywords,
        imageUri:
          (c.printing.imageUris?.small as string | undefined) ?? null,
        inDeck: {
          printingId: c.deckCardRow.printingId,
          category: c.deckCardRow.category,
        },
      }),
    onRemove: () =>
      void removeCard(c.deckCardRow.printingId, c.deckCardRow.category),
    onMove: (toCategory: string) =>
      void moveCard(
        c.deckCardRow.printingId,
        c.deckCardRow.category,
        toCategory,
      ),
    inCi: colorIdentity,
  });

  return (
    <section className="flex h-full max-h-[calc(100vh-128px)] flex-col overflow-hidden rounded-md border border-border-strong bg-surface-raised shadow-sm shadow-black/5">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {deck.commander && (
          <CommanderRow
            commander={deck.commander}
            label="Commander"
            isActive={activeOracleId === deck.commander.oracleId}
          />
        )}
        {deck.partner && (
          <CommanderRow
            commander={deck.partner}
            label="Partner"
            isActive={activeOracleId === deck.partner.oracleId}
          />
        )}

        {mainGroups.length === 0 ? (
          <div className="m-4 rounded-md border border-dashed border-border-subtle px-6 py-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Empty main
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Press{" "}
              <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">
                /
              </kbd>{" "}
              and start adding cards. Hit{" "}
              <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              to drop the top result into main.
            </p>
          </div>
        ) : (
          mainGroups.map((g) => (
            <section key={g.group}>
              <GroupHeader title={g.group} count={groupCount(g.cards)} />
              <ul>
                {g.cards.map((c) => (
                  <Row
                    key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                    {...rowProps(c)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        {maybeboard.length > 0 && (
          <details className="group/maybe" open>
            <summary className="cursor-pointer list-none">
              <GroupHeader
                title="Maybeboard"
                count={groupCount(maybeboard)}
                collapsible
              />
            </summary>
            <ul>
              {maybeboard.map((c) => (
                <Row
                  key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                  {...rowProps(c)}
                  dim
                />
              ))}
            </ul>
          </details>
        )}

        {considering.length > 0 && (
          <details>
            <summary className="cursor-pointer list-none">
              <GroupHeader
                title="Considering"
                count={groupCount(considering)}
                collapsible
              />
            </summary>
            <ul>
              {considering.map((c) => (
                <Row
                  key={`${c.deckCardRow.printingId}-${c.deckCardRow.category}`}
                  {...rowProps(c)}
                  dim
                />
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Validation + curve — precise instrument feel */}
      <div className="shrink-0 border-t border-border-subtle bg-surface-inset/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
          {outOfCI.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-[var(--color-bracket-3)]"
              title={outOfCI.map((c) => c.card.name).join(", ")}
            >
              <span className="size-1.5 rounded-full bg-[var(--color-bracket-3)]" />
              {outOfCI.length} outside CI
            </span>
          )}
          {singletonViolations.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-[var(--color-value-negative)]"
              title={singletonViolations
                .map((c) => `${c.card.name} (×${c.deckCardRow.quantity})`)
                .join(", ")}
            >
              <span className="size-1.5 rounded-full bg-[var(--color-value-negative)]" />
              {singletonViolations.length} singleton violation
              {singletonViolations.length === 1 ? "" : "s"}
            </span>
          )}
          {outOfCI.length === 0 && singletonViolations.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-[var(--color-value-positive)]">
              <span className="size-1.5 rounded-full bg-[var(--color-value-positive)]" />
              rules clean
            </span>
          )}
        </div>
        <ManaCurve curve={curve} />
      </div>
    </section>
  );
}

function GroupHeader({
  title,
  count,
  collapsible,
}: {
  title: string;
  count: number;
  collapsible?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-baseline justify-between border-b border-border-subtle bg-surface-raised/95 px-3 py-1.5 backdrop-blur">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {title}
        {collapsible && (
          <span className="ml-1 text-text-muted">·</span>
        )}
      </h3>
      <span className="font-mono text-[10px] tabular-nums text-text-muted">
        {count}
      </span>
    </div>
  );
}

function groupCount(cards: DeckCard[]): number {
  return cards.reduce((s, c) => s + c.deckCardRow.quantity, 0);
}

function CommanderRow({
  commander,
  label,
  isActive,
}: {
  commander: DeckCommander;
  label: string;
  isActive: boolean;
}) {
  return (
    <section>
      <GroupHeader title={label} count={1} />
      <div
        className={cn(
          "flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5",
          isActive && "border-l-brand bg-[var(--color-brand-soft)]/40",
        )}
      >
        <Thumb
          src={
            (commander.printing.imageUris?.small as string | undefined) ?? null
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-text-primary">
              {commander.name}
            </span>
            <ManaCost cost={commander.manaCost} size="xs" />
          </div>
          <p className="truncate font-mono text-[10px] text-text-muted">
            {commander.typeLine}
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({
  card,
  availability,
  inCi,
  isActive,
  dim,
  onActivate,
  onRemove,
  onMove,
}: {
  card: DeckCard;
  availability:
    | { owned: number; available: number; committedExcluding: number }
    | undefined;
  inCi: Set<string>;
  isActive: boolean;
  dim?: boolean;
  onActivate: () => void;
  onRemove: () => void;
  onMove: (toCategory: string) => void;
}) {
  const own = availability?.owned ?? 0;
  const avail = availability?.available ?? 0;
  let dotClass = "bg-[var(--color-unowned)]";
  let dotTitle = "Not owned";
  if (own > 0 && avail > 0) {
    dotClass = "bg-[var(--color-owned-available)]";
    dotTitle = `Owned (${avail} available)`;
  } else if (own > 0) {
    dotClass = "bg-[var(--color-owned-committed)]";
    dotTitle = `Owned, committed elsewhere (${own} total)`;
  }
  const outOfCI =
    inCi.size > 0 &&
    (card.card.colorIdentity ?? []).some((c) => !inCi.has(c));

  return (
    <li
      className={cn(
        "group/row flex items-center gap-2 border-l-2 border-transparent px-3 py-[3px] transition-colors",
        isActive
          ? "border-l-brand bg-[var(--color-brand-soft)]/40"
          : "hover:bg-surface-inset/60",
        dim && "opacity-80",
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 shrink-0 rounded-full",
          dotClass,
        )}
        title={dotTitle}
        aria-label={dotTitle}
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
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-muted">
          {card.deckCardRow.quantity}
        </span>
        <span className="truncate text-[13px] text-text-primary">
          {card.card.name}
        </span>
        <ManaCost cost={card.card.manaCost} size="xs" />
        {outOfCI && (
          <span
            className="rounded-sm bg-[var(--color-bracket-3)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--color-bracket-3)]"
            title="Outside commander color identity"
          >
            CI
          </span>
        )}
      </button>
      <select
        value={card.deckCardRow.category}
        onChange={(e) => onMove(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="rounded-sm border border-transparent bg-transparent font-mono text-[10px] uppercase tracking-wide text-text-muted opacity-0 transition-opacity hover:border-border-subtle focus:opacity-100 group-hover/row:opacity-100"
        aria-label="Move to category"
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
        className="text-text-muted opacity-0 transition-opacity hover:text-[var(--color-value-negative)] group-hover/row:opacity-100"
        aria-label={`Remove ${card.card.name}`}
      >
        <Trash2 className="size-3" />
      </button>
    </li>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src)
    return (
      <div className="size-9 shrink-0 rounded-sm bg-surface-inset ring-1 ring-border-subtle" />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-9 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
      loading="lazy"
    />
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
    <div className="mt-2 flex items-end gap-[6px]">
      <span className="mr-1 self-center font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
        Curve
      </span>
      {curve.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-[3px]">
          <span className="font-mono text-[9px] tabular-nums text-text-muted">
            {b.count > 0 ? b.count : ""}
          </span>
          <div
            className="w-3 rounded-sm bg-[var(--color-text-secondary)]/40 transition-[height]"
            style={{
              height: `${Math.round((b.count / max) * 24) + 2}px`,
            }}
          />
          <span className="font-mono text-[9px] tabular-nums text-text-muted">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}
