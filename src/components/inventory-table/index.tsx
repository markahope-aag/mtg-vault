"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManaCost } from "@/components/mana-cost";
import { SetSymbol } from "@/components/set-symbol";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { currentValueOf } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { EditRowDialog } from "./edit-row-dialog";
import { DisposeDialog } from "./dispose-dialog";
import { AddCardsPicker } from "./add-cards-picker";

type SortField =
  | "name"
  | "cmc"
  | "usd"
  | "acquiredAt"
  | "condition"
  | "location"
  | "createdAt";

type Totals = { totalCount: number; totalValueUsd: number };

const COLORS = ["W", "U", "B", "R", "G", "C"] as const;
const TYPE_OPTIONS = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
];

const COLOR_TOKEN: Record<string, string> = {
  W: "var(--color-mtg-white)",
  U: "var(--color-mtg-blue)",
  B: "var(--color-mtg-black)",
  R: "var(--color-mtg-red)",
  G: "var(--color-mtg-green)",
  C: "var(--color-mtg-colorless)",
};

export function InventoryTable({
  initialRows,
  initialNextCursor,
  initialTotals,
}: {
  initialRows: InventoryRowWithCard[];
  initialNextCursor: string | null;
  initialTotals: Totals;
}) {
  const [rows, setRows] = useState<InventoryRowWithCard[]>(initialRows);
  const [totals, setTotals] = useState<Totals>(initialTotals);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [grouped, setGrouped] = useState(true);
  const [includeDisposed, setIncludeDisposed] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [setFilter, setSetFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [foilsOnly, setFoilsOnly] = useState(false);

  const [locations, setLocations] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editingRow, setEditingRow] = useState<InventoryRowWithCard | null>(
    null,
  );
  const [disposingRows, setDisposingRows] = useState<InventoryRowWithCard[]>(
    [],
  );
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const nameTimerRef = useRef<number | null>(null);
  const handleNameChange = useCallback((v: string) => {
    setNameFilter(v);
    if (nameTimerRef.current != null) window.clearTimeout(nameTimerRef.current);
    nameTimerRef.current = window.setTimeout(() => setDebouncedName(v), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (nameTimerRef.current != null)
        window.clearTimeout(nameTimerRef.current);
    };
  }, []);

  const buildParams = useCallback(
    (cursor?: string | null): URLSearchParams => {
      const p = new URLSearchParams();
      p.set("limit", "50");
      if (cursor) p.set("cursor", cursor);
      p.set("sort", sortField);
      p.set("dir", sortDir);
      if (debouncedName.trim()) p.set("filter[name]", debouncedName.trim());
      if (colorFilter.size > 0)
        p.set("filter[colors]", [...colorFilter].join(","));
      if (typeFilter) p.set("filter[type]", typeFilter);
      if (setFilter.trim()) p.set("filter[set]", setFilter.trim());
      if (locationFilter) p.set("filter[location]", locationFilter);
      if (foilsOnly) p.set("filter[foilOnly]", "true");
      if (includeDisposed) p.set("filter[includeDisposed]", "true");
      return p;
    },
    [
      debouncedName,
      colorFilter,
      typeFilter,
      setFilter,
      locationFilter,
      foilsOnly,
      includeDisposed,
      sortField,
      sortDir,
    ],
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?${buildParams().toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotals({
        totalCount: data.totalCount ?? 0,
        totalValueUsd: data.totalValueUsd ?? 0,
      });
      setNextCursor(data.nextCursor ?? null);
      setSelected(new Set());
    } catch (err) {
      toast.error(
        `Couldn't load inventory: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/inventory?${buildParams(nextCursor).toString()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows((prev) => [...prev, ...(data.rows ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      toast.error(
        `Couldn't load more: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, nextCursor, loadingMore]);

  useEffect(
    () => {
      // refetch is reconstructed when any of these change; calling it here
      // synchronously is the intended trigger. setLoading inside refetch is
      // the UI feedback, not a runaway re-render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      debouncedName,
      colorFilter,
      typeFilter,
      setFilter,
      locationFilter,
      foilsOnly,
      includeDisposed,
      sortField,
      sortDir,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inventory/locations")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLocations(d.locations ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  const toggleColor = useCallback((color: string) => {
    setColorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setNameFilter("");
    setDebouncedName("");
    setColorFilter(new Set());
    setTypeFilter("");
    setSetFilter("");
    setLocationFilter("");
    setFoilsOnly(false);
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "name" ? "asc" : "desc");
      }
    },
    [sortField],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this row? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Deleted");
        refetch();
      } catch (err) {
        toast.error(
          `Couldn't delete: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [refetch],
  );

  const onRestore = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/inventory/${id}/restore`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Restored");
        refetch();
      } catch (err) {
        toast.error(
          `Couldn't restore: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [refetch],
  );

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<
      string,
      {
        key: string;
        oracleId: string;
        foil: boolean;
        name: string;
        imageUri: string | null;
        manaCost: string | null;
        typeLine: string | null;
        setCode: string;
        rarity: string | null;
        rows: InventoryRowWithCard[];
        totalValue: number;
        locationsCount: Map<string, number>;
        anyDisposed: boolean;
      }
    >();
    for (const r of rows) {
      const key = `${r.oracleId}|${r.foil ? "f" : "n"}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          oracleId: r.oracleId,
          foil: r.foil,
          name: r.name,
          imageUri: r.imageUri,
          manaCost: r.manaCost,
          typeLine: r.typeLine,
          setCode: r.setCode,
          rarity: r.rarity,
          rows: [],
          totalValue: 0,
          locationsCount: new Map(),
          anyDisposed: false,
        };
        map.set(key, entry);
      }
      entry.rows.push(r);
      entry.totalValue += currentValueOf(r);
      if (r.disposedAt) entry.anyDisposed = true;
      if (r.location) {
        entry.locationsCount.set(
          r.location,
          (entry.locationsCount.get(r.location) ?? 0) + 1,
        );
      }
    }
    return [...map.values()];
  }, [rows, grouped]);

  const hasAnyFilter =
    !!debouncedName ||
    colorFilter.size > 0 ||
    !!typeFilter ||
    !!setFilter ||
    !!locationFilter ||
    foilsOnly;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      {/* ──── Page header (canonical) ──── */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="space-y-2">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Inventory
          </p>
          <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
            Your collection
          </h1>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-[var(--text-secondary)]">
            <span>
              <span className="num font-medium text-[var(--text-primary)]">
                {totals.totalCount.toLocaleString()}
              </span>{" "}
              cards
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>
              <span className="num font-medium text-[var(--text-primary)]">
                $
                {totals.totalValueUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>{" "}
              market value
            </span>
            {grouped && groups && (
              <>
                <span className="text-[var(--text-muted)]">·</span>
                <span>
                  <span className="num font-medium text-[var(--text-primary)]">
                    {groups.length}
                  </span>{" "}
                  unique
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle grouped={grouped} onChange={setGrouped} />
          <a
            href="/api/inventory/export"
            download
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <ArrowDownToLine className="size-3.5" /> Export
          </a>
          <Link
            href="/import"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <ArrowUpFromLine className="size-3.5" /> Import CSV
          </Link>
          <Button
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" /> Add cards
          </Button>
        </div>
      </header>

      {/* ──── Filter bar ──── */}
      <section className="rounded-md border border-border-subtle bg-surface-inset/60">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-text-muted" />
            <input
              value={nameFilter}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Search by name…"
              className="h-7 w-full rounded-sm border border-border-subtle bg-surface-base pl-7 pr-2 text-[12px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
            />
          </div>
          <input
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            placeholder="SET"
            className="h-7 w-20 rounded-sm border border-border-subtle bg-surface-base px-2 font-mono text-[11px] uppercase tracking-wide text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
          />
          <Select
            value={typeFilter || "__all"}
            onValueChange={(v) =>
              setTypeFilter(!v || v === "__all" ? "" : v)
            }
          >
            <SelectTrigger className="h-7! w-32 rounded-sm! border-border-subtle bg-surface-base text-[11px]!">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={locationFilter || "__all"}
            onValueChange={(v) =>
              setLocationFilter(!v || v === "__all" ? "" : v)
            }
          >
            <SelectTrigger className="h-7! w-40 rounded-sm! border-border-subtle bg-surface-base text-[11px]!">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-wide">
            <ToggleLabel checked={foilsOnly} onChange={setFoilsOnly}>
              Foils only
            </ToggleLabel>
            <ToggleLabel
              checked={false}
              disabled
              onChange={() => {}}
              title="Wires up when decks have inventory bindings"
            >
              Available
            </ToggleLabel>
            <ToggleLabel checked={includeDisposed} onChange={setIncludeDisposed}>
              + Disposed
            </ToggleLabel>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Colors
          </span>
          {COLORS.map((c) => {
            const isActive = colorFilter.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full border font-mono text-[9px] font-semibold transition-colors",
                  isActive
                    ? "text-background"
                    : "border-border-subtle bg-surface-raised text-text-muted hover:border-border-strong",
                )}
                style={
                  isActive
                    ? {
                        background: COLOR_TOKEN[c],
                        borderColor: COLOR_TOKEN[c],
                      }
                    : undefined
                }
                aria-pressed={isActive}
                aria-label={`Toggle ${c} color`}
              >
                {c}
              </button>
            );
          })}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:text-text-primary"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border-subtle px-3 py-1.5">
            {debouncedName && (
              <ActiveChip
                label={`name "${debouncedName}"`}
                onClear={() => {
                  setNameFilter("");
                  setDebouncedName("");
                }}
              />
            )}
            {setFilter && (
              <ActiveChip
                label={`set ${setFilter.toUpperCase()}`}
                onClear={() => setSetFilter("")}
              />
            )}
            {typeFilter && (
              <ActiveChip
                label={`type ${typeFilter}`}
                onClear={() => setTypeFilter("")}
              />
            )}
            {locationFilter && (
              <ActiveChip
                label={`@ ${locationFilter}`}
                onClear={() => setLocationFilter("")}
              />
            )}
            {[...colorFilter].map((c) => (
              <ActiveChip
                key={c}
                label={c}
                tint={COLOR_TOKEN[c]}
                onClear={() => toggleColor(c)}
              />
            ))}
            {foilsOnly && (
              <ActiveChip
                label="foil only"
                onClear={() => setFoilsOnly(false)}
              />
            )}
          </div>
        )}
      </section>

      {/* ──── Table ──── */}
      <section className="overflow-x-auto rounded-md border border-border-subtle bg-surface-raised">
        {rows.length === 0 && !loading ? (
          <EmptyState hasFilters={hasAnyFilter} />
        ) : grouped && groups ? (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-subtle bg-surface-inset/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <th className="w-8 px-2 py-1.5"></th>
                <th className="w-12 px-2 py-1.5"></th>
                <SortHeader
                  field="name"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-1.5 text-left"
                >
                  Card
                </SortHeader>
                <th className="px-2 py-1.5 text-left">Type</th>
                <th className="w-12 px-2 py-1.5 text-left">Finish</th>
                <th className="w-16 px-2 py-1.5 text-right">Qty</th>
                <SortHeader
                  field="usd"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="w-24 px-2 py-1.5 text-right"
                >
                  Value
                </SortHeader>
                <SortHeader
                  field="location"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-1.5 text-left"
                >
                  Locations
                </SortHeader>
                <th className="w-8 px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRowRenderer
                  key={g.key}
                  group={g}
                  isOpen={expanded.has(g.key)}
                  onToggleExpand={() => toggleExpanded(g.key)}
                  selected={selected}
                  onToggleSelected={toggleSelected}
                  onEdit={setEditingRow}
                  onDispose={(r) => {
                    setDisposingRows([r]);
                    setDisposeOpen(true);
                  }}
                  onDelete={onDelete}
                  onRestore={onRestore}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-subtle bg-surface-inset/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <th className="w-8 px-2 py-1.5"></th>
                <th className="w-12 px-2 py-1.5"></th>
                <SortHeader
                  field="name"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-1.5 text-left"
                >
                  Card
                </SortHeader>
                <th className="w-16 px-2 py-1.5 text-left">Set</th>
                <th className="w-14 px-2 py-1.5 text-left">#</th>
                <th className="w-12 px-2 py-1.5 text-left">Finish</th>
                <SortHeader
                  field="condition"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="w-14 px-2 py-1.5 text-left"
                >
                  Cond
                </SortHeader>
                <SortHeader
                  field="location"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-1.5 text-left"
                >
                  Location
                </SortHeader>
                <SortHeader
                  field="usd"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="w-20 px-2 py-1.5 text-right"
                >
                  USD
                </SortHeader>
                <SortHeader
                  field="acquiredAt"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="w-20 px-2 py-1.5 text-right"
                >
                  Paid
                </SortHeader>
                <th className="w-8 px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PhysicalRowRenderer
                  key={r.id}
                  row={r}
                  selected={selected.has(r.id)}
                  onToggleSelected={() => toggleSelected(r.id)}
                  onEdit={() => setEditingRow(r)}
                  onDispose={() => {
                    setDisposingRows([r]);
                    setDisposeOpen(true);
                  }}
                  onDelete={() => onDelete(r.id)}
                  onRestore={() => onRestore(r.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {nextCursor && (
        <div className="flex justify-center pb-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            size="sm"
            className="font-mono text-[11px] uppercase tracking-wide"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {/* ──── Bulk actions bar ──── */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border-strong bg-surface-overlay px-4 py-2 shadow-lg shadow-black/30">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              Selected
            </span>
            <span className="num font-semibold text-text-primary">
              {selected.size}
            </span>
            <span className="h-4 w-px bg-border-subtle" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] uppercase tracking-wide"
              onClick={() => {
                const targets = rows.filter((r) => selected.has(r.id));
                setDisposingRows(targets);
                setDisposeOpen(true);
              }}
            >
              Dispose
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 font-mono text-[11px] uppercase tracking-wide text-text-muted hover:text-text-primary"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <EditRowDialog
        row={editingRow}
        open={editingRow !== null}
        onOpenChange={(v) => !v && setEditingRow(null)}
      />
      <DisposeDialog
        rows={disposingRows}
        open={disposeOpen}
        onOpenChange={(v) => {
          setDisposeOpen(v);
          if (!v) setDisposingRows([]);
        }}
      />
      <AddCardsPicker
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) refetch();
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ViewToggle({
  grouped,
  onChange,
}: {
  grouped: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      role="group"
      className="inline-flex overflow-hidden rounded-md border border-border-subtle"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "h-7 px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
          grouped
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
            : "bg-surface-raised text-text-muted hover:text-text-primary",
        )}
        aria-pressed={grouped}
      >
        Grouped
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "h-7 border-l border-border-subtle px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
          !grouped
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
            : "bg-surface-raised text-text-muted hover:text-text-primary",
        )}
        aria-pressed={!grouped}
      >
        Physical
      </button>
    </div>
  );
}

function ToggleLabel({
  checked,
  disabled,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5 text-text-secondary",
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
      {children}
    </label>
  );
}

function ActiveChip({
  label,
  onClear,
  tint,
}: {
  label: string;
  onClear: () => void;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="group/chip inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      {tint && (
        <span
          className="size-1.5 rounded-full"
          style={{ background: tint }}
        />
      )}
      {label}
      <X className="size-2.5 opacity-60 group-hover/chip:opacity-100" />
    </button>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="empty-terminal">
        {hasFilters ? "no matches" : "no inventory recorded"}
      </p>
      {hasFilters ? (
        <p className="text-sm text-text-secondary">
          No rows match the current filters.
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          Press{" "}
          <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          to search and add your first card, or import a CSV.
        </p>
      )}
    </div>
  );
}

function SortHeader({
  field,
  current,
  dir,
  onSort,
  className,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors",
          isActive
            ? "text-[var(--color-brand-strong)]"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3",
            isActive ? "opacity-100" : "opacity-40",
          )}
        />
      </button>
    </th>
  );
}

function GroupRowRenderer({
  group,
  isOpen,
  onToggleExpand,
  selected,
  onToggleSelected,
  onEdit,
  onDispose,
  onDelete,
  onRestore,
}: {
  group: {
    key: string;
    oracleId: string;
    foil: boolean;
    name: string;
    imageUri: string | null;
    manaCost: string | null;
    typeLine: string | null;
    setCode: string;
    rarity: string | null;
    rows: InventoryRowWithCard[];
    totalValue: number;
    locationsCount: Map<string, number>;
    anyDisposed: boolean;
  };
  isOpen: boolean;
  onToggleExpand: () => void;
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
  onEdit: (row: InventoryRowWithCard) => void;
  onDispose: (row: InventoryRowWithCard) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const locs = [...group.locationsCount.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border-subtle transition-colors",
          isOpen ? "bg-surface-inset/40" : "hover:bg-surface-inset/40",
        )}
      >
        <td className="px-2 py-1.5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        </td>
        <td className="px-2 py-1.5">
          <Thumb src={group.imageUri} alt={group.name} />
        </td>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/cards/${group.oracleId}`}
              target="_blank"
              rel="noopener"
              className="font-medium text-text-primary hover:underline"
            >
              {group.name}
            </Link>
            <ManaCost cost={group.manaCost} size="xs" />
          </div>
        </td>
        <td className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          {group.typeLine?.split("—")[0]?.trim() ?? "—"}
        </td>
        <td className="px-2 py-1.5">
          {group.foil ? (
            <span className="rounded-sm border border-[var(--color-mtg-multicolor)]/40 bg-[var(--color-mtg-multicolor)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--color-mtg-multicolor)]">
              Foil
            </span>
          ) : (
            <span className="font-mono text-[10px] text-text-muted">—</span>
          )}
        </td>
        <td className="px-2 py-1.5 text-right">
          <span className="num font-semibold text-text-primary">
            ×{group.rows.length}
          </span>
        </td>
        <td className="px-2 py-1.5 text-right">
          <span className="num text-text-primary">
            ${group.totalValue.toFixed(2)}
          </span>
        </td>
        <td className="px-2 py-1.5 font-mono text-[11px] text-text-muted">
          {locs.length === 0
            ? "—"
            : locs
                .slice(0, 3)
                .map(([loc, n]) => `${loc} (${n})`)
                .join(" · ")}
          {locs.length > 3 && ` +${locs.length - 3}`}
        </td>
        <td className="px-2 py-1.5"></td>
      </tr>
      {isOpen &&
        group.rows.map((r) => (
          <PhysicalRowRenderer
            key={r.id}
            row={r}
            selected={selected.has(r.id)}
            onToggleSelected={() => onToggleSelected(r.id)}
            onEdit={() => onEdit(r)}
            onDispose={() => onDispose(r)}
            onDelete={() => onDelete(r.id)}
            onRestore={() => onRestore(r.id)}
            inGroup
          />
        ))}
    </>
  );
}

function PhysicalRowRenderer({
  row,
  selected,
  onToggleSelected,
  onEdit,
  onDispose,
  onDelete,
  onRestore,
  inGroup,
}: {
  row: InventoryRowWithCard;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDispose: () => void;
  onDelete: () => void;
  onRestore: () => void;
  inGroup?: boolean;
}) {
  const disposed = !!row.disposedAt;
  return (
    <tr
      className={cn(
        "group/row border-b border-border-subtle transition-colors",
        disposed && "opacity-55",
        inGroup
          ? "bg-surface-inset/30 hover:bg-surface-inset/60"
          : "hover:bg-surface-inset/40",
      )}
    >
      <td className="px-2 py-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-3.5 cursor-pointer accent-[var(--color-brand)]"
          aria-label={`Select ${row.name}`}
        />
      </td>
      <td className="px-2 py-1">
        {!inGroup ? (
          <Thumb src={row.imageUri} alt={row.name} />
        ) : (
          <span
            className="ml-2 inline-block h-6 w-1 rounded-full bg-border-subtle"
            aria-hidden
          />
        )}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cards/${row.oracleId}`}
            target="_blank"
            rel="noopener"
            className="font-medium text-text-primary hover:underline"
          >
            {row.name}
          </Link>
          <ManaCost cost={row.manaCost} size="xs" />
          {disposed && (
            <span className="rounded-sm border border-border-strong bg-surface-inset px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              Disposed
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1">
        <span className="inline-flex items-center gap-1.5">
          <SetSymbol setCode={row.setCode} rarity={row.rarity} size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
            {row.setCode}
          </span>
        </span>
      </td>
      <td className="px-2 py-1 font-mono text-[11px] tabular-nums text-text-muted">
        {row.collectorNumber}
      </td>
      <td className="px-2 py-1">
        {row.foil ? (
          <span className="rounded-sm border border-[var(--color-mtg-multicolor)]/40 bg-[var(--color-mtg-multicolor)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--color-mtg-multicolor)]">
            Foil
          </span>
        ) : (
          <span className="font-mono text-[10px] text-text-muted">—</span>
        )}
      </td>
      <td className="px-2 py-1 font-mono text-[11px] text-text-secondary">
        {row.condition}
      </td>
      <td className="px-2 py-1 font-mono text-[11px] text-text-secondary">
        {row.location ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-2 py-1 text-right">
        <span className="num text-text-primary">
          ${currentValueOf(row).toFixed(2)}
        </span>
      </td>
      <td className="px-2 py-1 text-right">
        <span className="num text-text-muted">
          {row.acquiredPrice ? `$${Number(row.acquiredPrice).toFixed(2)}` : "—"}
        </span>
      </td>
      <td className="px-2 py-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-6 items-center justify-center rounded-sm text-text-muted opacity-0 transition-opacity hover:bg-surface-inset hover:text-text-primary group-hover/row:opacity-100 data-[state=open]:opacity-100"
            aria-label="Row actions"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            {disposed ? (
              <DropdownMenuItem onSelect={onRestore}>
                <Undo2 className="size-3.5" /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onDispose}>
                <Trash2 className="size-3.5" /> Mark disposed
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5" /> Delete row
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-9 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle">
        <ImageOff className="size-3.5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-9 rounded-sm object-cover ring-1 ring-border-subtle"
      loading="lazy"
    />
  );
}
