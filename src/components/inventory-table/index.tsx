"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { currentValueOf } from "@/lib/inventory/types";
import { EditRowDialog } from "./edit-row-dialog";
import { DisposeDialog } from "./dispose-dialog";

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

export function InventoryTable({
  initialRows,
  initialNextCursor,
  initialTotals,
}: {
  initialRows: InventoryRowWithCard[];
  initialNextCursor: string | null;
  initialTotals: Totals;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryRowWithCard[]>(initialRows);
  const [totals, setTotals] = useState<Totals>(initialTotals);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [grouped, setGrouped] = useState(true);
  const [includeDisposed, setIncludeDisposed] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [setFilter, setSetFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [foilsOnly, setFoilsOnly] = useState(false);

  const [locations, setLocations] = useState<string[]>([]);

  // Selection + expansion
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialogs
  const [editingRow, setEditingRow] = useState<InventoryRowWithCard | null>(null);
  const [disposingRows, setDisposingRows] = useState<InventoryRowWithCard[]>([]);
  const [disposeOpen, setDisposeOpen] = useState(false);

  // Debounce name filter
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
        `Failed to load inventory: ${err instanceof Error ? err.message : String(err)}`,
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
        `Failed to load more: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, nextCursor, loadingMore]);

  // Refetch when filters / sort change. setLoading inside refetch is the
  // intended UI feedback, not an accidental cascading render.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
    void refetch();
  }, [
    debouncedName,
    colorFilter,
    typeFilter,
    setFilter,
    locationFilter,
    foilsOnly,
    includeDisposed,
    sortField,
    sortDir,
  ]);

  // Locations for filter dropdown — refreshed whenever the row set changes.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/inventory/locations")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLocations(d.locations ?? []);
      })
      .catch(() => {
        /* ignore */
      });
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
          `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
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
          `Failed to restore: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [refetch],
  );

  // Group rows by (oracleId, foil)
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

  const totalsLabel = useMemo(() => {
    if (grouped && groups) {
      return `${groups.length} unique cards, ${totals.totalCount} total physical cards · $${totals.totalValueUsd.toFixed(2)}`;
    }
    return `${totals.totalCount} cards · $${totals.totalValueUsd.toFixed(2)}`;
  }, [grouped, groups, totals]);

  const hasAnyFilter =
    !!debouncedName ||
    colorFilter.size > 0 ||
    !!typeFilter ||
    !!setFilter ||
    !!locationFilter ||
    foilsOnly;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">{totalsLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={grouped}
              onChange={(e) => setGrouped(e.target.checked)}
              className="size-4"
            />
            Group by card
          </label>
          <Link
            href="/import"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Upload className="size-4" /> Import CSV
          </Link>
          <Button disabled variant="outline" size="sm">
            <Plus className="size-4" /> Add cards
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={nameFilter}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Search by name…"
              className="pl-8"
            />
          </div>
          <Input
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            placeholder="Set code"
            className="w-28"
          />
          <Select
            value={typeFilter || "__all"}
            onValueChange={(v) =>
              setTypeFilter(!v || v === "__all" ? "" : v)
            }
          >
            <SelectTrigger className="w-36">
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
            <SelectTrigger className="w-44">
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
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="size-4" /> Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">Colors:</span>
          {COLORS.map((c) => {
            const active = colorFilter.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                className={`inline-flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {c}
              </button>
            );
          })}
          <span className="mx-2 h-4 w-px bg-border" />
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={foilsOnly}
              onChange={(e) => setFoilsOnly(e.target.checked)}
              className="size-3.5"
            />
            Foils only
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground" title="Wires up after decks are built">
            <input type="checkbox" disabled className="size-3.5" />
            Available (not in decks)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeDisposed}
              onChange={(e) => setIncludeDisposed(e.target.checked)}
              className="size-3.5"
            />
            Include disposed
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <p className="text-base font-medium text-foreground">
              No cards yet.
            </p>
            <p>
              Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px]">⌘K</kbd> to search and add your first card, or import from CSV (Phase 5).
            </p>
          </div>
        ) : grouped && groups ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 text-left"></th>
                <th className="w-12 px-2 py-2 text-left"></th>
                <SortHeader
                  field="name"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-left"
                >
                  Card
                </SortHeader>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Foil</th>
                <th className="px-2 py-2 text-right">Count</th>
                <th className="px-2 py-2 text-right">Value</th>
                <th className="px-2 py-2 text-left">Locations</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isOpen = expanded.has(g.key);
                return (
                  <GroupRowRenderer
                    key={g.key}
                    group={g}
                    isOpen={isOpen}
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
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="w-12 px-2 py-2"></th>
                <SortHeader
                  field="name"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-left"
                >
                  Name
                </SortHeader>
                <th className="px-2 py-2 text-left">Set</th>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Foil</th>
                <SortHeader
                  field="condition"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-left"
                >
                  Cond
                </SortHeader>
                <SortHeader
                  field="location"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-left"
                >
                  Location
                </SortHeader>
                <SortHeader
                  field="usd"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-right"
                >
                  USD
                </SortHeader>
                <SortHeader
                  field="acquiredAt"
                  current={sortField}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="px-2 py-2 text-right"
                >
                  Paid
                </SortHeader>
                <th className="w-10 px-2 py-2"></th>
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
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            size="sm"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-card px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <span className="h-4 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
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
  const active = current === field;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 font-medium text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {children}
        <Icon className="size-3" />
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
  const locsLabel =
    [...group.locationsCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([loc, n]) => `${loc} (${n})`)
      .join(", ") || "—";

  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td className="px-2 py-1.5">
          <Thumb src={group.imageUri} alt={group.name} />
        </td>
        <td className="px-2 py-2">
          <Link
            href={`/cards/${group.oracleId}`}
            target="_blank"
            rel="noopener"
            className="font-medium hover:underline"
          >
            {group.name}
          </Link>
        </td>
        <td className="px-2 py-2 text-xs text-muted-foreground">
          {group.typeLine ?? "—"}
        </td>
        <td className="px-2 py-2">
          {group.foil ? (
            <Badge variant="secondary" className="text-[10px]">
              FOIL
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right font-medium tabular-nums">
          ×{group.rows.length}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          ${group.totalValue.toFixed(2)}
        </td>
        <td className="px-2 py-2 text-xs text-muted-foreground">
          {locsLabel}
        </td>
        <td className="px-2 py-2"></td>
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
      className={`border-b transition-opacity ${disposed ? "opacity-60" : ""} ${
        inGroup ? "bg-muted/10" : "hover:bg-muted/30"
      }`}
    >
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-4"
        />
      </td>
      <td className="px-2 py-1.5">
        {!inGroup && <Thumb src={row.imageUri} alt={row.name} />}
      </td>
      <td className="px-2 py-1.5">
        <Link
          href={`/cards/${row.oracleId}`}
          target="_blank"
          rel="noopener"
          className="hover:underline"
        >
          {row.name}
        </Link>
        {disposed && (
          <Badge variant="destructive" className="ml-2 text-[10px]">
            DISPOSED
          </Badge>
        )}
      </td>
      <td className="px-2 py-1.5 text-xs">
        <span className="font-medium uppercase">{row.setCode}</span>
      </td>
      <td className="px-2 py-1.5 text-xs text-muted-foreground">
        {row.collectorNumber}
      </td>
      <td className="px-2 py-1.5">
        {row.foil ? (
          <Badge variant="secondary" className="text-[10px]">
            FOIL
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-xs">{row.condition}</td>
      <td className="px-2 py-1.5 text-xs">{row.location ?? "—"}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        ${currentValueOf(row).toFixed(2)}
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
        {row.acquiredPrice ? `$${row.acquiredPrice}` : "—"}
      </td>
      <td className="px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
            {disposed ? (
              <DropdownMenuItem onSelect={onRestore}>
                <Undo2 className="size-4" /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onDispose}>
                <Trash2 className="size-4" /> Mark disposed
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" /> Delete row
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
      <div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-10 rounded object-cover"
      loading="lazy"
    />
  );
}
