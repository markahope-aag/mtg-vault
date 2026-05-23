"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { CONDITIONS } from "@/lib/inventory/schemas";

type InventoryRow = {
  id: string;
  name: string;
  setCode: string;
  setName: string;
  foil: boolean;
  etched: boolean;
  condition: string;
  imageUri: string | null;
  currentValue: number;
};

type SearchResult = {
  oracleId: string;
  name: string;
  defaultPrintingId: string | null;
  imageUri: string | null;
  typeLine: string | null;
};

type OutRow = InventoryRow & { value: string };
type InRow = {
  oracleId: string;
  printingId: string;
  name: string;
  setCode: string;
  setName: string;
  imageUri: string | null;
  foil: boolean;
  etched: boolean;
  condition: (typeof CONDITIONS)[number];
  language: string;
  location: string;
  value: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewTradeForm() {
  const router = useRouter();
  const [partner, setPartner] = useState("");
  const [tradedAt, setTradedAt] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [outRows, setOutRows] = useState<OutRow[]>([]);
  const [inRows, setInRows] = useState<InRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const outTotal = useMemo(
    () =>
      outRows.reduce((s, r) => s + (Number.parseFloat(r.value) || 0), 0),
    [outRows],
  );
  const inTotal = useMemo(
    () => inRows.reduce((s, r) => s + (Number.parseFloat(r.value) || 0), 0),
    [inRows],
  );
  const net = inTotal - outTotal;

  const canSubmit =
    !!partner.trim() &&
    (outRows.length > 0 || inRows.length > 0) &&
    !submitting;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            partner: partner.trim(),
            tradedAt: tradedAt ? new Date(tradedAt).toISOString() : undefined,
            notes: notes.trim() || null,
            out: outRows.map((r) => ({
              inventoryId: r.id,
              value: Number.parseFloat(r.value) || 0,
            })),
            in: inRows.map((r) => ({
              printingId: r.printingId,
              foil: r.foil,
              etched: r.etched,
              condition: r.condition,
              language: r.language,
              location: r.location || null,
              value: Number.parseFloat(r.value) || 0,
            })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        toast.success(`Trade with ${partner} logged.`);
        router.push("/trades");
        router.refresh();
      } catch (err) {
        toast.error(
          `Couldn't log trade: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, partner, tradedAt, notes, outRows, inRows, router],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Partner
            </Label>
            <Input
              required
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="Name or handle"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Date
            </Label>
            <Input
              type="date"
              value={tradedAt}
              onChange={(e) => setTradedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Notes
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this trade (e.g. partial payment in cash, owed money, etc.)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OutColumn rows={outRows} setRows={setOutRows} />
        <InColumn rows={inRows} setRows={setInRows} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-4 font-mono uppercase tracking-wide text-xs">
            <span>
              <span className="text-text-muted">Out:</span>{" "}
              <span className="tabular-nums text-[var(--value-negative)]">
                ${outTotal.toFixed(2)}
              </span>
            </span>
            <span>
              <span className="text-text-muted">In:</span>{" "}
              <span className="tabular-nums text-[var(--value-positive)]">
                ${inTotal.toFixed(2)}
              </span>
            </span>
            <span>
              <span className="text-text-muted">Net:</span>{" "}
              <span
                className={`font-semibold tabular-nums ${net >= 0 ? "text-[var(--value-positive)]" : "text-[var(--value-negative)]"}`}
              >
                {net >= 0 ? "+" : ""}${net.toFixed(2)}
              </span>
            </span>
          </div>
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "Logging…" : "Log trade"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function OutColumn({
  rows,
  setRows,
}: {
  rows: OutRow[];
  setRows: React.Dispatch<React.SetStateAction<OutRow[]>>;
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
              (r: {
                id: string;
                disposedAt: string | null;
                tradeId: string | null;
              }) => r.disposedAt == null && !pickedIds.has(r.id),
            )
            .map(
              (r: {
                id: string;
                name: string;
                setCode: string;
                setName: string;
                foil: boolean;
                etched: boolean;
                condition: string;
                imageUri: string | null;
                usd: string | null;
                usdFoil: string | null;
              }) => ({
                id: r.id,
                name: r.name,
                setCode: r.setCode,
                setName: r.setName,
                foil: r.foil,
                etched: r.etched,
                condition: r.condition,
                imageUri: r.imageUri,
                currentValue:
                  Number.parseFloat(r.foil ? (r.usdFoil ?? r.usd ?? "0") : (r.usd ?? "0")) || 0,
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
          <span>Cards going out</span>
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
            Nothing going out yet. Search above to add cards.
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
                  <span className="font-mono text-[10px] text-text-muted">
                    $
                  </span>
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

function InColumn({
  rows,
  setRows,
}: {
  rows: InRow[];
  setRows: React.Dispatch<React.SetStateAction<InRow[]>>;
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
            setName: printing.setName,
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
          <span>Cards coming in</span>
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
            Nothing coming in yet. Search above to add cards.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r, idx) => (
              <li
                key={`${r.printingId}-${idx}`}
                className="space-y-1.5 rounded-md border border-border-subtle bg-surface-raised p-2"
              >
                <div className="flex items-center gap-2">
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
                      {r.setCode}
                    </p>
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
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Select
                    value={r.condition}
                    onValueChange={(v) =>
                      setRows((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                condition: v as (typeof CONDITIONS)[number],
                              }
                            : row,
                        ),
                      )
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
                      checked={r.foil}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, foil: e.target.checked } : row,
                          ),
                        )
                      }
                    />
                    Foil
                  </label>
                  <Input
                    value={r.location}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, location: e.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Location"
                    className="h-7 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-text-muted">
                      $
                    </span>
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
                      className="h-7 flex-1 text-xs"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
