"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/app/api/search/route";

// Lightweight autocomplete for opponent commanders. Hits /api/search
// with commanderOnly=true; debounces 250ms. On pick, fires onSelect
// with the resolved oracleId + name; otherwise the parent keeps the
// raw typed text as commanderNameSnapshot so unresolvable names still
// log usefully.
export function CommanderSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Commander (optional)",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (r: { oracleId: string; name: string } | null) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide stale results when the query is too short rather than calling
  // setResults([]) in the effect (which triggers a cascading render).
  const shortQuery = value.trim().length < 2;
  const visibleResults = shortQuery ? [] : results;

  useEffect(() => {
    if (shortQuery) return;
    let cancel = false;
    const t = setTimeout(async () => {
      if (cancel) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(value.trim())}&commanderOnly=true&limit=8`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchResult[] };
        if (!cancel) setResults(data.results ?? []);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [value, shortQuery]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          // Typing fresh text invalidates any previously-resolved oracle id.
          onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && !shortQuery && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border-subtle bg-surface-raised shadow-md">
          {loading && (
            <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
          )}
          {!loading && visibleResults.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-muted">
              No matches — your typed text will be saved as a snapshot.
            </div>
          )}
          {visibleResults.map((r) => (
            <button
              key={r.oracleId}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-inset"
              onMouseDown={(e) => {
                // mousedown not click — onBlur on the input fires first
                // and would close the popover before click registers.
                e.preventDefault();
                onChange(r.name);
                onSelect({ oracleId: r.oracleId, name: r.name });
                setOpen(false);
              }}
            >
              {r.name}
              {r.typeLine && (
                <span className="ml-2 text-[11px] text-text-muted">
                  {r.typeLine}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
