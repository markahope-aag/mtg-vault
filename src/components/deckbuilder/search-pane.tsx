"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useDeckbuilder } from "./shell";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { ManaCost } from "@/components/mana-cost";
import { pickCardImage } from "@/lib/card-image";
import { cn } from "@/lib/utils";

type SearchResult = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  colorIdentity: string[] | null;
  edhrecRank: number | null;
  defaultPrintingId: string | null;
  imageUri: string | null;
};

const TYPE_CHIPS = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
];

export function SearchPane() {
  const {
    deck,
    availability,
    active,
    setActive,
    addCard,
    pendingOracleIds,
    registerSearchFocus,
  } = useDeckbuilder();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [colorIdFilter, setColorIdFilter] = useState(true);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    registerSearchFocus(() => inputRef.current?.focus());
  }, [registerSearchFocus]);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const colorIdentity = deck.colorIdentity;
  const ciCsv = colorIdentity.join(",");

  const doSearch = useCallback(
    async (q: string) => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "30");
      if (colorIdFilter && colorIdentity.length > 0)
        params.set("filter[colorIdentity]", ciCsv);
      if (ownedOnly) params.set("filter[ownedOnly]", "true");
      if (activeTypes.size > 0)
        params.set("filter[types]", [...activeTypes].join(","));
      try {
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        setResults([]);
        toast.error(
          `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [activeTypes, ciCsv, colorIdFilter, colorIdentity.length, ownedOnly],
  );

  const onQueryChange = useCallback(
    (next: string) => {
      setQuery(next);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      if (!next.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = window.setTimeout(() => {
        void doSearch(next.trim());
      }, 150);
    },
    [doSearch],
  );

  useEffect(
    () => {
      if (!query.trim()) return;
      // Filter toggles re-trigger the active query.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      void doSearch(query.trim());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colorIdFilter, ownedOnly, activeTypes],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOwnedOnly((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleType(t: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const recentlyAdded = useMemo(
    () =>
      [...deck.cards]
        .filter((c) => c.deckCardRow.category === "main")
        .slice(0, 10),
    [deck.cards],
  );

  const showResults = !!query.trim();
  const showEmpty = !showResults && recentlyAdded.length === 0;

  return (
    <aside className="flex h-full max-h-[calc(100vh-128px)] flex-col gap-0 overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
      <header className="shrink-0 border-b border-border-subtle bg-surface-inset/60 px-3 pb-2 pt-2.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Search
          </p>
          <kbd className="rounded-sm border border-border-subtle bg-surface-raised px-1 font-mono text-[10px] text-text-muted">
            /
          </kbd>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                const r = results[0];
                if (r.defaultPrintingId)
                  void addCard(r.defaultPrintingId, r.oracleId, "main");
              }
            }}
            placeholder="Card name…"
            className="w-full rounded-sm border border-border-subtle bg-surface-base py-1.5 pl-7 pr-2 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-brand"
          />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <ToggleLabel
            checked={colorIdFilter}
            disabled={colorIdentity.length === 0}
            onChange={setColorIdFilter}
          >
            Color identity
          </ToggleLabel>
          <ToggleLabel checked={ownedOnly} onChange={setOwnedOnly}>
            Only owned
            <kbd className="ml-1 rounded-sm border border-border-subtle bg-surface-raised px-1 font-mono text-[9px] text-text-muted">
              ⌘/
            </kbd>
          </ToggleLabel>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {TYPE_CHIPS.map((t) => {
            const isActive = activeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                  isActive
                    ? "border-brand bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
                    : "border-border-subtle bg-surface-raised text-text-muted hover:border-border-strong hover:text-text-secondary",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {!showResults && recentlyAdded.length > 0 && (
          <>
            <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Recently added
            </p>
            <ul>
              {recentlyAdded.map((c) => (
                <ResultRow
                  key={c.deckCardRow.printingId}
                  result={{
                    oracleId: c.card.oracleId,
                    name: c.card.name,
                    manaCost: c.card.manaCost,
                    typeLine: c.card.typeLine,
                    colorIdentity: c.card.colorIdentity,
                    edhrecRank: null,
                    defaultPrintingId: c.printing.id,
                    imageUri: pickCardImage(
                      c.printing.imageUris,
                      c.printing.cardFaces,
                      "small",
                    ),
                  }}
                  availability={availability[c.card.oracleId]}
                  pending={pendingOracleIds.has(c.card.oracleId)}
                  isActive={active?.oracleId === c.card.oracleId}
                  setActive={setActive}
                  addCard={addCard}
                />
              ))}
            </ul>
          </>
        )}

        {showEmpty && (
          <div className="px-3 py-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              Empty deck
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Press <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">/</kbd> to search,{" "}
              <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">↵</kbd> to add.
            </p>
          </div>
        )}

        {showResults && (
          <ul>
            {loading && (
              <li className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Searching…
              </li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-text-secondary">
                No results for{" "}
                <code className="font-mono">&ldquo;{query}&rdquo;</code>.
              </li>
            )}
            {results.map((r) => (
              <ResultRow
                key={r.oracleId}
                result={r}
                availability={availability[r.oracleId]}
                pending={pendingOracleIds.has(r.oracleId)}
                isActive={active?.oracleId === r.oracleId}
                setActive={setActive}
                addCard={addCard}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ToggleLabel({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3 cursor-pointer accent-[var(--color-brand)]"
      />
      <span className="text-text-secondary">{children}</span>
    </label>
  );
}

function ResultRow({
  result,
  availability,
  pending,
  isActive,
  setActive,
  addCard,
}: {
  result: SearchResult;
  availability:
    | { owned: number; available: number; committedExcluding: number }
    | undefined;
  pending: boolean;
  isActive: boolean;
  setActive: (next: import("./shell").ActiveCard | null) => void;
  addCard: (
    printingId: string,
    oracleId: string,
    category?: string,
  ) => Promise<void>;
}) {
  const avail = availability?.available ?? 0;
  const owned = availability?.owned ?? 0;
  const dotColor =
    owned > 0 && avail > 0
      ? "bg-[var(--color-owned-available)]"
      : owned > 0
        ? "bg-[var(--color-owned-committed)]"
        : "bg-[var(--color-unowned)]";

  return (
    <li
      className={cn(
        "group/result flex items-center gap-2 border-l-2 border-transparent px-2 py-1 transition-colors",
        isActive
          ? "border-l-brand bg-[var(--color-brand-soft)]/40"
          : "hover:bg-surface-inset/60",
      )}
    >
      <button
        type="button"
        onClick={() =>
          setActive({
            oracleId: result.oracleId,
            name: result.name,
            manaCost: result.manaCost,
            typeLine: result.typeLine,
            oracleText: null,
            colorIdentity: result.colorIdentity,
            keywords: null,
            imageUri: result.imageUri,
          })
        }
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Thumb src={result.imageUri} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-medium text-text-primary">
              {result.name}
            </p>
            <ManaCost cost={result.manaCost} size="xs" />
          </div>
          <p className="truncate font-mono text-[10px] text-text-muted">
            {result.typeLine}
          </p>
        </div>
      </button>
      <span
        className="shrink-0"
        title={
          owned === 0
            ? "Not owned"
            : avail === 0
              ? `${owned} owned · committed elsewhere`
              : `${avail}/${owned} available`
        }
      >
        <span className={cn("inline-block size-1.5 rounded-full", dotColor)} />
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">
        {avail}/{owned}
      </span>
      <button
        type="button"
        onClick={() => {
          if (result.defaultPrintingId)
            void addCard(result.defaultPrintingId, result.oracleId, "main");
        }}
        disabled={pending || !result.defaultPrintingId}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-raised text-text-muted transition-colors hover:border-brand hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand-strong)] disabled:opacity-40 disabled:hover:border-border-subtle disabled:hover:bg-surface-raised"
        aria-label={`Add ${result.name} to main`}
      >
        <Plus className="size-3.5" />
      </button>
    </li>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <ImgWithFallback
      src={src}
      alt=""
      className="size-9 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
      fallbackClassName="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-text-muted"
      fallbackIconClassName="size-3.5"
      loading="lazy"
    />
  );
}
