"use client";

import { useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImgWithFallback } from "@/components/img-with-fallback";
import type { InventoryRow, OutLine } from "./types";

// Inventory search + selected-rows list for the "out" side of a
// sale or trade. Each picked row gets a value override input.

export function OutColumn({
  rows,
  setRows,
}: {
  rows: OutLine[];
  setRows: React.Dispatch<React.SetStateAction<OutLine[]>>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("filter[name]", trimmed);
        params.set("limit", "20");
        const res = await fetch(`/api/inventory?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const pickedIds = new Set(rows.map((r) => r.id));
        setResults(
          (data.rows ?? [])
            .filter(
              (r: { id: string; disposedAt: string | null }) =>
                r.disposedAt == null && !pickedIds.has(r.id),
            )
            .map(
              (r: {
                id: string;
                name: string;
                setCode: string;
                foil: boolean;
                condition: string;
                imageUri: string | null;
                printingId: string;
                usd: string | null;
                usdFoil: string | null;
              }) => ({
                id: r.id,
                name: r.name,
                setCode: r.setCode,
                foil: r.foil,
                condition: r.condition,
                imageUri: r.imageUri,
                printingId: r.printingId,
                currentValue:
                  Number.parseFloat(
                    r.foil ? (r.usdFoil ?? r.usd ?? "0") : (r.usd ?? "0"),
                  ) || 0,
              }),
            ),
        );
      } catch (err) {
        toast.error(
          `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, rows]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Out (from inventory)</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            {rows.length} card{rows.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your inventory…"
            className="pl-8"
          />
        </div>
        {query.trim() && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border-subtle bg-surface-inset/40 p-1">
            {loading ? (
              <li className="px-2 py-1 text-xs text-text-muted">Searching…</li>
            ) : results.length === 0 ? (
              <li className="px-2 py-1 text-xs text-text-muted">No matches.</li>
            ) : (
              results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRows((prev) => [
                        ...prev,
                        { ...r, value: r.currentValue.toFixed(2) },
                      ]);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-surface-inset"
                  >
                    <ImgWithFallback
                      src={r.imageUri}
                      alt={r.name}
                      className="size-7 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                      fallbackClassName="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                      fallbackIconClassName="size-3"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="font-mono uppercase text-[10px] text-text-muted">
                      {r.setCode} · {r.condition}
                      {r.foil ? " · F" : ""}
                    </span>
                    <span className="font-mono tabular-nums text-text-muted">
                      ${r.currentValue.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Nothing going out yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r, idx) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2"
              >
                <ImgWithFallback
                  src={r.imageUri}
                  alt={r.name}
                  className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                  fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                  fallbackIconClassName="size-4"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{r.name}</p>
                  <p className="font-mono text-[10px] uppercase text-text-muted">
                    {r.setCode} · {r.condition}
                    {r.foil ? " · Foil" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-text-muted">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.value}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, value: e.target.value } : row,
                        ),
                      )
                    }
                    className="h-7 w-20 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)]"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
