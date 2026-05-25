"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { CONDITIONS } from "@/lib/inventory/schemas";
import type { InLine, SearchResult } from "./types";

// Card search + new-inventory-row list for the "in" side of a
// purchase or trade. Each row gets per-card condition / foil /
// location / value fields.

export function InColumn({
  rows,
  setRows,
}: {
  rows: InLine[];
  setRows: React.Dispatch<React.SetStateAction<InLine[]>>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=15`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        toast.error(
          `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  const addCard = useCallback(
    async (r: SearchResult) => {
      if (!r.defaultPrintingId) return;
      try {
        const res = await fetch(`/api/cards/${r.oracleId}/detail`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const printing =
          data.printings.find(
            (p: { id: string }) => p.id === r.defaultPrintingId,
          ) ?? data.printings[0];
        if (!printing) return;
        setRows((prev) => [
          ...prev,
          {
            oracleId: r.oracleId,
            printingId: printing.id,
            name: r.name,
            setCode: printing.setCode,
            imageUri: printing.imageUri ?? r.imageUri,
            foil: false,
            etched: false,
            condition: "NM",
            language: "en",
            location: "",
            value: printing.usd ?? "",
          },
        ]);
        setQuery("");
      } catch (err) {
        toast.error(
          `Couldn't add card: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [setRows],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>In (new inventory)</span>
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
            placeholder="Search any card…"
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
                <li key={r.oracleId}>
                  <button
                    type="button"
                    onClick={() => addCard(r)}
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
                    <span className="font-mono text-[10px] uppercase text-text-muted">
                      {r.typeLine?.split(" — ")[0] ?? ""}
                    </span>
                    <Plus className="size-3 text-text-muted" />
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Nothing coming in yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r, idx) => (
              <InRowEditor
                key={`${r.printingId}-${idx}`}
                row={r}
                onChange={(next) =>
                  setRows((prev) =>
                    prev.map((row, i) => (i === idx ? next : row)),
                  )
                }
                onRemove={() =>
                  setRows((prev) => prev.filter((_, i) => i !== idx))
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// One incoming card row — image + name on top, condition / foil /
// location / value on the bottom. Pulled out so the InColumn map
// stays readable.
function InRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: InLine;
  onChange: (next: InLine) => void;
  onRemove: () => void;
}) {
  return (
    <li className="space-y-1.5 rounded-md border border-border-subtle bg-surface-raised p-2">
      <div className="flex items-center gap-2">
        <ImgWithFallback
          src={row.imageUri}
          alt={row.name}
          className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
          fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
          fallbackIconClassName="size-4"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium">{row.name}</p>
          <p className="font-mono text-[10px] uppercase text-text-muted">
            {row.setCode}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)]"
          aria-label="Remove"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Select
          value={row.condition}
          onValueChange={(v) =>
            onChange({
              ...row,
              condition: v as (typeof CONDITIONS)[number],
            })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={row.foil}
            onChange={(e) => onChange({ ...row, foil: e.target.checked })}
          />
          Foil
        </label>
        <Input
          value={row.location}
          onChange={(e) => onChange({ ...row, location: e.target.value })}
          placeholder="Location"
          className="h-7 text-xs"
        />
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-text-muted">$</span>
          <Input
            type="number"
            step="0.01"
            value={row.value}
            onChange={(e) => onChange({ ...row, value: e.target.value })}
            className="h-7 flex-1 text-xs"
          />
        </div>
      </div>
    </li>
  );
}
