"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Search, X } from "lucide-react";

export type CommanderPick = {
  printingId: string;
  oracleId: string;
  name: string;
  imageUri: string | null;
  oracleText: string | null;
  colorIdentity: string[] | null;
  typeLine: string | null;
};

type SearchResult = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  defaultPrintingId: string | null;
  imageUri: string | null;
};

export function CommanderSearch({
  value,
  onChange,
  label = "Commander",
  placeholder = "Search commanders…",
}: {
  value: CommanderPick | null;
  onChange: (next: CommanderPick | null) => void;
  label?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  function onQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(next)}&limit=12&commanderOnly=true`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  async function selectResult(r: SearchResult) {
    if (!r.defaultPrintingId) return;
    // Fetch the full card oracle_text + color_identity so the partner toggle
    // can be displayed without a second round-trip.
    try {
      const res = await fetch(`/api/decks/_lookup?printingId=${r.defaultPrintingId}`);
      if (res.ok) {
        const data = await res.json();
        onChange({
          printingId: r.defaultPrintingId,
          oracleId: r.oracleId,
          name: r.name,
          imageUri: r.imageUri,
          oracleText: data.oracleText ?? null,
          colorIdentity: data.colorIdentity ?? null,
          typeLine: r.typeLine,
        });
      } else {
        onChange({
          printingId: r.defaultPrintingId,
          oracleId: r.oracleId,
          name: r.name,
          imageUri: r.imageUri,
          oracleText: null,
          colorIdentity: null,
          typeLine: r.typeLine,
        });
      }
    } catch {
      onChange({
        printingId: r.defaultPrintingId,
        oracleId: r.oracleId,
        name: r.name,
        imageUri: r.imageUri,
        oracleText: null,
        colorIdentity: null,
        typeLine: r.typeLine,
      });
    }
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-3 rounded-md border bg-card p-2">
          <Thumb src={value.imageUri} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            {value.typeLine && (
              <p className="truncate text-xs text-muted-foreground">
                {value.typeLine}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground">Searching…</p>
      )}
      {!loading && results.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
          {results.map((r) => (
            <button
              key={r.oracleId}
              type="button"
              onClick={() => selectResult(r)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
            >
              <Thumb src={r.imageUri} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.typeLine}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && query && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No legal commanders match &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-10 rounded object-cover"
      loading="lazy"
    />
  );
}
