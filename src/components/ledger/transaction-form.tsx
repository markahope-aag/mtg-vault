"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
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

type Kind = "purchase" | "sale" | "trade";
type Channel = "lgs" | "online_marketplace" | "private" | "pack" | "other";

type InventoryRow = {
  id: string;
  name: string;
  setCode: string;
  foil: boolean;
  condition: string;
  imageUri: string | null;
  printingId: string;
  currentValue: number;
};

type SearchResult = {
  oracleId: string;
  name: string;
  defaultPrintingId: string | null;
  imageUri: string | null;
  typeLine: string | null;
};

type OutLine = InventoryRow & { value: string };
type InLine = {
  oracleId: string;
  printingId: string;
  name: string;
  setCode: string;
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

export function TransactionForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("purchase");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [counterparty, setCounterparty] = useState("");
  const [channel, setChannel] = useState<Channel>("lgs");
  const [cashOut, setCashOut] = useState("");
  const [cashIn, setCashIn] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");
  const [outRows, setOutRows] = useState<OutLine[]>([]);
  const [inRows, setInRows] = useState<InLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Show out side for sale + trade; in side for purchase + trade.
  // Cash legs: out side always available (purchase paid, trade gave cash);
  // in side available for sale + trade.
  const showOut = kind === "sale" || kind === "trade";
  const showIn = kind === "purchase" || kind === "trade";
  const showCashOut = kind !== "sale";
  const showCashIn = kind !== "purchase";

  // Live preview of what allocation will look like. Mirrors the server's
  // logic so the user can verify their cost-basis split before submit.
  const allocationPreview = useMemo(() => {
    const cashOutNum = Number.parseFloat(cashOut) || 0;
    const cashInNum = Number.parseFloat(cashIn) || 0;
    const inAllocated = inRows.map((r) =>
      Number.parseFloat(r.value) || 0,
    );
    const outAllocated = outRows.map((r) =>
      Number.parseFloat(r.value) || 0,
    );
    return {
      inTotal: inAllocated.reduce((s, v) => s + v, 0),
      outTotal: outAllocated.reduce((s, v) => s + v, 0),
      cashOutNum,
      cashInNum,
    };
  }, [inRows, outRows, cashOut, cashIn]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      if (kind === "purchase" && inRows.length === 0) {
        toast.error("A purchase needs at least one card going in.");
        return;
      }
      if (kind === "sale" && outRows.length === 0) {
        toast.error("A sale needs at least one card going out.");
        return;
      }
      if (kind === "trade" && (inRows.length === 0 || outRows.length === 0)) {
        toast.error("A trade needs at least one card on each side.");
        return;
      }

      // The actual submit — extracted so we can run it directly for a
      // pure purchase (no disposal risk) or behind a confirm for sales
      // and trades that will dispose physical inventory rows.
      const commit = async () => {
        setSubmitting(true);
        try {
          const lines = [
            ...outRows.map((r) => ({
              direction: "out" as const,
              printingId: r.printingId,
              inventoryId: r.id,
              allocatedValueOverride: r.value
                ? Number.parseFloat(r.value)
                : null,
            })),
            ...inRows.map((r) => ({
              direction: "in" as const,
              printingId: r.printingId,
              foil: r.foil,
              etched: r.etched,
              condition: r.condition,
              language: r.language,
              location: r.location || null,
              allocatedValueOverride: r.value
                ? Number.parseFloat(r.value)
                : null,
            })),
          ];
          const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind,
              occurredAt: new Date(occurredAt).toISOString(),
              counterparty: counterparty.trim() || null,
              channel,
              cashOutUsd: cashOut ? Number.parseFloat(cashOut) : null,
              cashInUsd: cashIn ? Number.parseFloat(cashIn) : null,
              feesUsd: fees ? Number.parseFloat(fees) : null,
              notes: notes.trim() || null,
              lines,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
          toast.success(`Logged ${kind}`);
          router.push(`/trades/${body.id}`);
          router.refresh();
        } catch (err) {
          toast.error(
            `Couldn't log: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          setSubmitting(false);
        }
      };

      // Purchases don't dispose anything — submit straight through.
      if (outRows.length === 0) {
        await commit();
        return;
      }

      // Sales + trades dispose physical inventory rows. Confirm before
      // committing, since the dispose isn't a one-click undo (you'd
      // restore each row from the ledger detail page).
      const cardLabel = outRows.length === 1 ? "card" : "cards";
      const verb = kind === "sale" ? "sell" : "trade away";
      confirmToast(`Confirm ${kind}?`, {
        description: `This will mark ${outRows.length} physical ${cardLabel} disposed (${verb}d). You can restore individual rows from the transaction detail page if needed.`,
        confirmLabel: `Yes, ${verb}`,
        onConfirm: () => {
          void commit();
        },
      });
    },
    [
      kind,
      outRows,
      inRows,
      occurredAt,
      counterparty,
      channel,
      cashOut,
      cashIn,
      fees,
      notes,
      submitting,
      router,
    ],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Kind selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Kind
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["purchase", "sale", "trade"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  kind === k
                    ? "border-[var(--brand)] bg-[var(--color-brand-soft)]/30"
                    : "border-border-subtle hover:border-border-strong"
                }`}
              >
                <p className="font-medium capitalize">{k}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {k === "purchase" && "Cards in for cash out."}
                  {k === "sale" && "Cards out for cash in."}
                  {k === "trade" && "Both, with optional cash either side."}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Header fields */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Counterparty
            </Label>
            <Input
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={
                kind === "purchase"
                  ? "Card Kingdom, LGS, etc."
                  : kind === "sale"
                    ? "TCGPlayer, buyer name, etc."
                    : "Trade partner"
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Date
            </Label>
            <Input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Channel
            </Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel((v as Channel) ?? "other")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lgs">LGS</SelectItem>
                <SelectItem value="online_marketplace">
                  Online marketplace
                </SelectItem>
                <SelectItem value="private">Private (person-to-person)</SelectItem>
                <SelectItem value="pack">Pack opening / draft</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {showCashOut && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Cash out
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashOut}
                  onChange={(e) => setCashOut(e.target.value)}
                />
              </div>
            )}
            {showCashIn && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Cash in
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashIn}
                  onChange={(e) => setCashIn(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Fees
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Notes
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context to remember — receipts, deal context, etc."
            />
          </div>
        </CardContent>
      </Card>

      <div
        className={`grid grid-cols-1 gap-6 ${kind === "trade" ? "lg:grid-cols-2" : ""}`}
      >
        {showOut && <OutColumn rows={outRows} setRows={setOutRows} />}
        {showIn && <InColumn rows={inRows} setRows={setInRows} />}
      </div>

      {/* Allocation preview + submit */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-4 font-mono uppercase text-xs">
            {showOut && (
              <span>
                <span className="text-text-muted">Out lines: </span>
                <span className="tabular-nums text-[var(--value-negative)]">
                  ${allocationPreview.outTotal.toFixed(2)}
                </span>
              </span>
            )}
            {showIn && (
              <span>
                <span className="text-text-muted">In lines: </span>
                <span className="tabular-nums text-[var(--value-positive)]">
                  ${allocationPreview.inTotal.toFixed(2)}
                </span>
              </span>
            )}
            {kind === "purchase" &&
              Math.abs(
                allocationPreview.inTotal - allocationPreview.cashOutNum,
              ) > 0.01 &&
              allocationPreview.cashOutNum > 0 && (
                <span className="text-amber-500">
                  Override sum ≠ cash out — the server will auto-allocate the
                  remainder.
                </span>
              )}
            {kind === "sale" &&
              Math.abs(
                allocationPreview.outTotal - allocationPreview.cashInNum,
              ) > 0.01 &&
              allocationPreview.cashInNum > 0 && (
                <span className="text-amber-500">
                  Override sum ≠ cash in — the server will auto-allocate the
                  remainder.
                </span>
              )}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Logging…" : "Log transaction"}
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
                            i === idx
                              ? { ...row, foil: e.target.checked }
                              : row,
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
                          i === idx
                            ? { ...row, location: e.target.value }
                            : row,
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
