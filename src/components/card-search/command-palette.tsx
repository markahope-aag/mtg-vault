"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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

type SearchResponse = {
  results: SearchResult[];
  source: "local" | "scryfall";
};

const RECENT_KEY = "mtg-vault:recent-searches";
const RECENT_LIMIT = 5;
const DEBOUNCE_MS = 150;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  try {
    const existing = readRecent();
    const next = [trimmed, ...existing.filter((x) => x !== trimmed)].slice(
      0,
      RECENT_LIMIT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [source, setSource] = useState<"local" | "scryfall">("local");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Cancel anything in flight if the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = useCallback((trimmed: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SearchResponse;
        if (controller.signal.aborted) return;
        setResults(data.results ?? []);
        setSource(data.source ?? "local");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[command-palette] search failed", err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
  }, []);

  const onQueryChange = useCallback(
    (next: string) => {
      setQuery(next);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      const trimmed = next.trim();
      if (!trimmed) {
        abortRef.current?.abort();
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = window.setTimeout(() => {
        runSearch(trimmed);
      }, DEBOUNCE_MS);
    },
    [runSearch],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        // Fresh state every time the palette opens.
        setQuery("");
        setResults([]);
        setSource("local");
        setLoading(false);
        setRecent(readRecent());
      } else {
        abortRef.current?.abort();
        if (debounceRef.current != null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const onSelect = useCallback(
    (result: SearchResult) => {
      pushRecent(query);
      handleOpenChange(false);
      router.push(`/cards/${result.oracleId}`);
    },
    [query, router, handleOpenChange],
  );

  const trimmed = query.trim();
  const showRecent = !trimmed && recent.length > 0;
  const showHint = !trimmed && recent.length === 0;
  const showNoResults = !!trimmed && !loading && results.length === 0;

  const sourceBadge = useMemo(() => {
    if (source !== "scryfall" || results.length === 0) return null;
    return (
      <Badge variant="secondary" className="text-[10px]">
        Scryfall syntax
      </Badge>
    );
  }, [source, results.length]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[20%] translate-y-0 overflow-hidden rounded-xl! p-0"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search cards</DialogTitle>
          <DialogDescription>
            Type to search by card name, or use Scryfall syntax for advanced
            queries.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="bg-transparent">
          <CommandInput
            value={query}
            onValueChange={onQueryChange}
            placeholder="Search cards..."
          />
          <CommandList className="max-h-[440px]!">
            {showHint && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Search className="mx-auto mb-3 h-5 w-5 opacity-50" />
                Type to search, or use Scryfall syntax like
                <br />
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  t:creature c:wu cmc=3
                </code>
              </div>
            )}

            {loading && (
              <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                Searching…
              </div>
            )}

            {showNoResults && (
              <CommandEmpty>
                No cards match &ldquo;{trimmed}&rdquo;.
              </CommandEmpty>
            )}

            {showRecent && (
              <CommandGroup heading="Recent">
                {recent.map((q) => (
                  <CommandItem
                    key={q}
                    value={`recent:${q}`}
                    onSelect={() => onQueryChange(q)}
                    className="gap-3"
                  >
                    <History className="size-4 opacity-50" />
                    <span>{q}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.length > 0 && (
              <CommandGroup
                heading={source === "scryfall" ? "Scryfall results" : "Cards"}
              >
                {results.map((r) => (
                  <CommandItem
                    key={r.oracleId}
                    value={`${r.oracleId}|${r.name}`}
                    onSelect={() => onSelect(r)}
                    className="gap-3"
                  >
                    {r.manaCost ? (
                      <ManaCost cost={r.manaCost} size="xs" />
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.name}
                    </span>
                    <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline-block sm:max-w-[200px]">
                      {r.typeLine}
                    </span>
                    {r.edhrecRank != null && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        #{r.edhrecRank}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ navigate · ↵ open · esc close</span>
            {sourceBadge}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
