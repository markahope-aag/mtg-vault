"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageOff, Plus, Search } from "lucide-react";
import { useDeckbuilder } from "./shell";
import { ManaCost } from "@/components/mana-cost";

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

  // Register focus method with the shell so the `/` shortcut can call us.
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
      } catch {
        setResults([]);
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

  // Re-run search when filters change
  useEffect(() => {
    if (!query.trim()) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    setLoading(true);
    void doSearch(query.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorIdFilter, ownedOnly, activeTypes]);

  // Cmd+/ → toggle owned-only
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

  return (
    <aside className="flex h-full max-h-[calc(100vh-160px)] flex-col gap-3 overflow-hidden rounded-lg border bg-card">
      <div className="flex shrink-0 flex-col gap-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
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
            placeholder="Search…"
            className="w-full rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={colorIdFilter}
              onChange={(e) => setColorIdFilter(e.target.checked)}
              className="size-3.5"
              disabled={colorIdentity.length === 0}
            />
            Color identity
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={ownedOnly}
              onChange={(e) => setOwnedOnly(e.target.checked)}
              className="size-3.5"
            />
            Only owned
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPE_CHIPS.map((t) => {
            const active = activeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!query.trim() ? (
          <>
            <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recently added
            </p>
            <ul className="space-y-1">
              {recentlyAdded.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground">
                  Deck is empty.
                </li>
              )}
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
                    imageUri:
                      (c.printing.imageUris?.small as string | undefined) ??
                      null,
                  }}
                  availability={availability[c.card.oracleId]}
                  pending={pendingOracleIds.has(c.card.oracleId)}
                  setActive={setActive}
                  addCard={addCard}
                />
              ))}
            </ul>
          </>
        ) : (
          <ul className="space-y-1">
            {loading && (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                Searching…
              </li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No results.
              </li>
            )}
            {results.map((r) => (
              <ResultRow
                key={r.oracleId}
                result={r}
                availability={availability[r.oracleId]}
                pending={pendingOracleIds.has(r.oracleId)}
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

function ResultRow({
  result,
  availability,
  pending,
  setActive,
  addCard,
}: {
  result: SearchResult;
  availability:
    | { owned: number; available: number; committedExcluding: number }
    | undefined;
  pending: boolean;
  setActive: (next: import("./shell").ActiveCard | null) => void;
  addCard: (
    printingId: string,
    oracleId: string,
    category?: string,
  ) => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md p-1 hover:bg-muted/50">
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
            <p className="truncate text-sm font-medium">{result.name}</p>
            <ManaCost cost={result.manaCost} size="xs" />
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {result.typeLine}
          </p>
        </div>
      </button>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {availability ? `${availability.available}/${availability.owned}` : "0/0"}
      </span>
      <button
        type="button"
        onClick={() => {
          if (result.defaultPrintingId)
            void addCard(result.defaultPrintingId, result.oracleId, "main");
        }}
        disabled={pending || !result.defaultPrintingId}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-card p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Add to deck"
      >
        <Plus className="size-4" />
      </button>
    </li>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-10 shrink-0 rounded object-cover"
      loading="lazy"
    />
  );
}
