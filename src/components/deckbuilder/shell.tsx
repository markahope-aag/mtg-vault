"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AvailabilityMap } from "@/db/queries/availability";
import type { DeckDetail } from "@/lib/decks/types";
import { pickCardImage } from "@/lib/card-image";
import { DeckbuilderHeader } from "./header";
import { SearchPane } from "./search-pane";
import { Decklist } from "./decklist";
import { DetailPane } from "./detail-pane";
import { StrategyPane } from "./strategy-pane";
import { CoachPane } from "./coach-pane";
import { AcquirePane } from "./acquire-pane";
import { ShortcutFooter } from "./shortcut-footer";
import { ExportDialog } from "./export-dialog";
import { BracketPanel } from "./bracket-panel";
import { cn } from "@/lib/utils";
import { Compass, Eye, ShoppingCart, Sparkles } from "lucide-react";

export type ActiveCard = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colorIdentity: string[] | null;
  keywords: string[] | null;
  imageUri: string | null;
  // If this card is currently in the deck, we know its printing/category too.
  inDeck?: { printingId: string; category: string };
};

type DeckbuilderContextValue = {
  deck: DeckDetail;
  availability: AvailabilityMap;
  setActive: (next: ActiveCard | null) => void;
  active: ActiveCard | null;
  addCard: (
    printingId: string,
    oracleId: string,
    category?: string,
    delta?: number,
  ) => Promise<void>;
  removeCard: (printingId: string, category: string) => Promise<void>;
  moveCard: (
    printingId: string,
    fromCategory: string,
    toCategory: string,
  ) => Promise<void>;
  swapPrinting: (
    fromPrintingId: string,
    toPrintingId: string,
    oracleId: string,
    category: string,
  ) => Promise<void>;
  setCommanderPrinting: (
    printingId: string,
    slot: "commander" | "partner",
  ) => Promise<void>;
  pendingOracleIds: Set<string>;
  focusSearch: () => void;
  registerSearchFocus: (fn: () => void) => void;
};

const DeckbuilderContext = createContext<DeckbuilderContextValue | null>(null);

export function useDeckbuilder(): DeckbuilderContextValue {
  const ctx = useContext(DeckbuilderContext);
  if (!ctx) throw new Error("useDeckbuilder must be used inside DeckbuilderShell");
  return ctx;
}

export function DeckbuilderShell({
  initialDeck,
  initialAvailability,
}: {
  initialDeck: DeckDetail;
  initialAvailability: AvailabilityMap;
}) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckDetail>(initialDeck);
  const [availability, setAvailability] = useState<AvailabilityMap>(
    initialAvailability,
  );
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [pendingOracleIds, setPendingOracleIds] = useState<Set<string>>(
    new Set(),
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [bracketOpen, setBracketOpen] = useState(false);
  const [searchFocusFn, setSearchFocusFn] = useState<(() => void) | null>(null);

  const focusSearch = useCallback(() => {
    searchFocusFn?.();
  }, [searchFocusFn]);

  const registerSearchFocus = useCallback((fn: () => void) => {
    setSearchFocusFn(() => fn);
  }, []);

  // Refresh availability + deck state for one oracle id after a mutation.
  const refreshAvailability = useCallback(
    async (oracleIds: string[]) => {
      if (oracleIds.length === 0) return;
      try {
        const res = await fetch(`/api/decks/${deck.deck.id}/availability`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ oracleIds }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { availability: AvailabilityMap };
        setAvailability((prev) => ({ ...prev, ...data.availability }));
      } catch {
        /* swallow */
      }
    },
    [deck.deck.id],
  );

  const refreshDeck = useCallback(async () => {
    try {
      const res = await fetch(`/api/decks/${deck.deck.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as DeckDetail;
      setDeck(data);
    } catch {
      /* swallow */
    }
  }, [deck.deck.id]);

  const addCard = useCallback(
    async (
      printingId: string,
      oracleId: string,
      category = "main",
      delta = 1,
    ) => {
      setPendingOracleIds((p) => new Set([...p, oracleId]));
      try {
        const res = await fetch(`/api/decks/${deck.deck.id}/cards`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ printingId, category, delta }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // Surface a banned-card warning if the server flagged this card. The
        // add still happens — the user can remove it; this is just a heads-up
        // so a banned card doesn't sneak in unnoticed.
        if (body.bannedWarning) {
          toast.warning(body.bannedWarning);
        }
        await Promise.all([refreshDeck(), refreshAvailability([oracleId])]);
      } catch (err) {
        toast.error(
          `Failed to add: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setPendingOracleIds((p) => {
          const next = new Set(p);
          next.delete(oracleId);
          return next;
        });
      }
    },
    [deck.deck.id, refreshAvailability, refreshDeck],
  );

  const removeCard = useCallback(
    async (printingId: string, category: string) => {
      const target = deck.cards.find(
        (c) =>
          c.deckCardRow.printingId === printingId &&
          c.deckCardRow.category === category,
      );
      const oracleId = target?.card.oracleId;
      try {
        const res = await fetch(
          `/api/decks/${deck.deck.id}/cards/${printingId}?category=${encodeURIComponent(category)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        await refreshDeck();
        if (oracleId) await refreshAvailability([oracleId]);
      } catch (err) {
        toast.error(
          `Failed to remove: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [deck.cards, deck.deck.id, refreshAvailability, refreshDeck],
  );

  const moveCard = useCallback(
    async (printingId: string, fromCategory: string, toCategory: string) => {
      try {
        const res = await fetch(`/api/decks/${deck.deck.id}/cards`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ printingId, fromCategory, toCategory }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        await refreshDeck();
      } catch (err) {
        toast.error(
          `Failed to move: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [deck.deck.id, refreshDeck],
  );

  const swapPrinting = useCallback(
    async (
      fromPrintingId: string,
      toPrintingId: string,
      oracleId: string,
      category: string,
    ) => {
      try {
        await fetch(
          `/api/decks/${deck.deck.id}/cards/${fromPrintingId}?category=${encodeURIComponent(category)}`,
          { method: "DELETE" },
        );
        await fetch(`/api/decks/${deck.deck.id}/cards`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            printingId: toPrintingId,
            category,
            delta: 1,
          }),
        });
        await Promise.all([refreshDeck(), refreshAvailability([oracleId])]);
      } catch (err) {
        toast.error(
          `Failed to swap printing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [deck.deck.id, refreshAvailability, refreshDeck],
  );

  // Change which printing the commander (or partner) uses — that's a column
  // on the deck itself, not a deck_cards row, so it's a deck PATCH.
  const setCommanderPrinting = useCallback(
    async (printingId: string, slot: "commander" | "partner") => {
      try {
        const res = await fetch(`/api/decks/${deck.deck.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            slot === "commander"
              ? { commanderPrintingId: printingId }
              : { partnerPrintingId: printingId },
          ),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        await refreshDeck();
      } catch (err) {
        toast.error(
          `Failed to change printing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [deck.deck.id, refreshDeck],
  );

  // Cmd+S → snapshot. Cmd+B → bracket drawer. Esc → clear active. / → focus search.
  // Cmd+/ → toggled inside the search pane via ref. Backspace handled by decklist row.
  // Cmd+K is handled by the global CommandPaletteProvider already.
  const onKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const cmd = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        if (active) {
          setActive(null);
          e.preventDefault();
          return;
        }
      }
      if (e.key === "/" && !isTextInput) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (cmd && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setBracketOpen(true);
        return;
      }
      if (cmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        try {
          const res = await fetch(
            `/api/decks/${deck.deck.id}/bracket?writeSnapshot=true`,
            { method: "POST" },
          );
          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail.error ?? `HTTP ${res.status}`);
          }
          const data = await res.json();
          const bracketLabel =
            data.bracket != null ? `Bracket ${data.bracket}` : "Bracket pending";
          const value = data.snapshot?.totalValueUsd ?? 0;
          toast.success(
            `Snapshot saved: $${Number(value).toFixed(2)} · ${bracketLabel}`,
          );
        } catch (err) {
          toast.error(
            `Snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return;
      }
    },
    [active, deck.deck.id, focusSearch],
  );

  // Attach the keydown listener
  if (typeof window !== "undefined") {
    // We use a ref-like attached-once pattern via useEffect in client. Done below.
  }

  // Bind once
  useKeyDown(onKeyDown);

  const ctxValue = useMemo<DeckbuilderContextValue>(
    () => ({
      deck,
      availability,
      setActive,
      active,
      addCard,
      removeCard,
      moveCard,
      swapPrinting,
      setCommanderPrinting,
      pendingOracleIds,
      focusSearch,
      registerSearchFocus,
    }),
    [
      deck,
      availability,
      active,
      addCard,
      removeCard,
      moveCard,
      swapPrinting,
      setCommanderPrinting,
      pendingOracleIds,
      focusSearch,
      registerSearchFocus,
    ],
  );

  // Pull commander image for the header
  const commanderImg = pickCardImage(
    deck.commander?.printing.imageUris,
    deck.commander?.printing.cardFaces,
    "normal",
  );

  return (
    <DeckbuilderContext.Provider value={ctxValue}>
      <div className="flex min-h-[calc(100vh-49px)] flex-col bg-background">
        <DeckbuilderHeader
          deck={deck}
          commanderImg={commanderImg}
          onExport={() => setExportOpen(true)}
          onRefreshed={() => router.refresh()}
          onOpenBracket={() => setBracketOpen(true)}
        />

        <div className="hidden flex-1 grid-cols-[340px_minmax(0,1fr)_400px] gap-3 p-3 lg:grid">
          <SearchPane />
          <Decklist />
          <RightPane />
        </div>

        {/* Below 1024px the three panes don't fit. Render the decklist alone
             and surface the trading-desk-voiced banner so the experience
             degrades on-brand rather than collapsing into broken columns. */}
        <div className="flex flex-1 flex-col gap-3 p-3 lg:hidden">
          <div className="rounded-md border border-border-subtle bg-surface-inset px-4 py-3 text-xs">
            <p className="font-mono uppercase tracking-[0.18em] text-text-muted">
              terminal width
            </p>
            <p className="mt-1 text-text-secondary">
              The deckbuilder is built for ≥1024px. Decklist shown; search and
              detail panes are hidden until you widen the window.
            </p>
          </div>
          <Decklist />
        </div>

        <ShortcutFooter />
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          deck={deck}
        />
        <BracketPanel
          open={bracketOpen}
          onOpenChange={setBracketOpen}
          deckId={deck.deck.id}
          targetBracket={deck.deck.targetBracket}
          onRemoveCard={async (oracleId) => {
            const target = deck.cards.find(
              (c) => c.card.oracleId === oracleId,
            );
            if (!target) return;
            await removeCard(
              target.deckCardRow.printingId,
              target.deckCardRow.category,
            );
          }}
        />
      </div>
    </DeckbuilderContext.Provider>
  );
}

// Lightweight effect helper to avoid yet another file.
import { useEffect } from "react";
function useKeyDown(handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}

type RightTab = "detail" | "coach" | "strategy" | "acquire";

function RightPane() {
  const [tab, setTab] = useState<RightTab>("detail");
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-inset/60 p-1">
        <TabButton active={tab === "detail"} onClick={() => setTab("detail")}>
          <Eye className="size-3.5" /> Detail
        </TabButton>
        <TabButton active={tab === "coach"} onClick={() => setTab("coach")}>
          <Compass className="size-3.5" /> Coach
        </TabButton>
        <TabButton
          active={tab === "strategy"}
          onClick={() => setTab("strategy")}
        >
          <Sparkles className="size-3.5" /> Strategy
        </TabButton>
        <TabButton
          active={tab === "acquire"}
          onClick={() => setTab("acquire")}
        >
          <ShoppingCart className="size-3.5" /> Acquire
        </TabButton>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "detail" ? (
          <DetailPane />
        ) : tab === "coach" ? (
          <CoachPane />
        ) : tab === "strategy" ? (
          <StrategyPane />
        ) : (
          <AcquirePane />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-6 flex-1 items-center justify-center gap-1.5 rounded-sm font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
        active
          ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
          : "text-text-muted hover:text-text-primary",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
