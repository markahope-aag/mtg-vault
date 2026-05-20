"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManaCost } from "@/components/mana-cost";
import {
  AddCardsDialog,
  type AddDialogCard,
} from "./add-cards-dialog";

type SearchResult = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  edhrecRank: number | null;
  imageUri: string | null;
};

const DEBOUNCE_MS = 150;

export function AddCardsPicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<AddDialogCard | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Reset the picker's local state when the dialog closes; the dialog
    // open state is parent-owned, so doing this here is the intended trigger.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setResults([]);
    setLoading(false);
  }, [open]);

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
        const data = (await res.json()) as { results: SearchResult[] };
        if (controller.signal.aborted) return;
        setResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[add-cards-picker] search failed", err);
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

  const onPick = useCallback(async (r: SearchResult) => {
    setResolving(true);
    try {
      const res = await fetch(`/api/cards/${r.oracleId}/detail`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const card: AddDialogCard = {
        oracleId: data.card.oracleId,
        name: data.card.name,
        printings: data.printings,
      };
      setResolved(card);
      onOpenChange(false);
    } catch (err) {
      console.error("[add-cards-picker] resolve failed", err);
    } finally {
      setResolving(false);
    }
  }, [onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="top-[18%] translate-y-0 max-w-xl gap-0 overflow-hidden rounded-md! p-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Add cards to inventory</DialogTitle>
            <DialogDescription>
              Search by name, pick a card, then choose printing and details.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-inset px-3 py-2">
            <Search className="size-3.5 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search a card to add…"
              className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="text-text-muted transition-colors hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {!query.trim() && (
              <div className="px-4 py-10 text-center text-[12px] text-text-muted">
                Type to search by card name.
              </div>
            )}
            {query.trim() && loading && (
              <div className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wide text-text-muted">
                Searching…
              </div>
            )}
            {query.trim() && !loading && results.length === 0 && (
              <div className="px-4 py-10 text-center text-[12px] text-text-muted">
                No matches for &ldquo;{query.trim()}&rdquo;.
              </div>
            )}
            {results.length > 0 && (
              <ul className="divide-y divide-border-subtle">
                {results.map((r) => (
                  <li key={r.oracleId}>
                    <button
                      type="button"
                      disabled={resolving}
                      onClick={() => void onPick(r)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-inset/60 disabled:opacity-50"
                    >
                      {r.manaCost ? (
                        <ManaCost cost={r.manaCost} size="xs" />
                      ) : (
                        <span className="inline-block w-5" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">
                        {r.name}
                      </span>
                      <span className="hidden truncate text-[11px] text-text-muted sm:inline sm:max-w-[180px]">
                        {r.typeLine}
                      </span>
                      {r.edhrecRank != null && (
                        <span className="num shrink-0 rounded-sm border border-border-subtle bg-surface-raised px-1 text-[10px] text-text-muted">
                          #{r.edhrecRank}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border-subtle bg-surface-inset px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            <span>↵ pick · esc close</span>
            {resolving && <span>Loading printings…</span>}
          </div>
        </DialogContent>
      </Dialog>

      <AddCardsDialog
        card={resolved}
        open={resolved !== null}
        onOpenChange={(next) => {
          if (!next) setResolved(null);
        }}
      />
    </>
  );
}
