"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Plus,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { EditRowDialog } from "./edit-row-dialog";
import { DisposeDialog } from "./dispose-dialog";
import { AddCardsPicker } from "./add-cards-picker";
import { ScanCardDialog } from "./scan-card-dialog";
import { CreateDeckFromSelectionDialog } from "./create-deck-dialog";
import {
  buildInventoryParams,
  groupRowsByOracleAndFoil,
  hasAnyFilter as hasAnyFilterFn,
  selectionToDeckCards,
  toggleInSet,
  toggleSort as toggleSortFn,
  type SortField,
} from "./logic";
import { EmptyState, ViewToggle } from "./parts";
import { FilterBar } from "./filter-bar";
import { BulkActionBar } from "./bulk-action-bar";
import { GroupedView, PhysicalView } from "./views";

type Totals = { totalCount: number; totalValueUsd: number };

/**
 * Orchestrator for the Inventory page. Owns:
 *  - Query state (filters + sort + pagination cursor)
 *  - Server data (rows, totals, locations)
 *  - Selection + expansion state
 *  - Dialog open state for the five inventory dialogs
 *
 * Presentation is delegated to:
 *  - filter-bar.tsx — the search + filter chips strip
 *  - views.tsx — the GroupedView and PhysicalView tables + row renderers
 *  - bulk-action-bar.tsx — the floating Create-deck / Dispose / Clear bar
 *  - parts.tsx — ViewToggle, EmptyState, SortHeader, Thumb, ToggleLabel, ActiveChip
 *
 * Logic-without-React helpers live in logic.ts and are unit-tested
 * separately (logic.test.ts).
 */
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
  const [bannedOnly, setBannedOnly] = useState(false);

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
  const [scanOpen, setScanOpen] = useState(false);
  const [createDeckOpen, setCreateDeckOpen] = useState(false);

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
    (cursor?: string | null): URLSearchParams =>
      buildInventoryParams(
        {
          name: debouncedName,
          colors: colorFilter,
          type: typeFilter,
          set: setFilter,
          location: locationFilter,
          foilsOnly,
          bannedOnly,
          includeDisposed,
        },
        { field: sortField, dir: sortDir },
        { cursor },
      ),
    [
      debouncedName,
      colorFilter,
      typeFilter,
      setFilter,
      locationFilter,
      foilsOnly,
      bannedOnly,
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
      bannedOnly,
      includeDisposed,
      sortField,
      sortDir,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inventory/locations")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.error ?? `HTTP ${r.status}`);
        }
        return data;
      })
      .then((d) => {
        if (!cancelled) setLocations(d.locations ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          `Couldn't load locations: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  const toggleColor = useCallback((color: string) => {
    setColorFilter((prev) => toggleInSet(prev, color));
  }, []);

  const clearFilters = useCallback(() => {
    setNameFilter("");
    setDebouncedName("");
    setColorFilter(new Set());
    setTypeFilter("");
    setSetFilter("");
    setLocationFilter("");
    setFoilsOnly(false);
    setBannedOnly(false);
  }, []);

  const onNameClear = useCallback(() => {
    setNameFilter("");
    setDebouncedName("");
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      const next = toggleSortFn({ field: sortField, dir: sortDir }, field);
      setSortField(next.field);
      setSortDir(next.dir);
    },
    [sortField, sortDir],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => toggleInSet(prev, id));
  }, []);

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => toggleInSet(prev, key));
  }, []);

  const onDelete = useCallback(
    (id: string) => {
      confirmToast("Delete this row?", {
        description: "This cannot be undone.",
        onConfirm: async () => {
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
      });
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

  const onDisposeFromRow = useCallback((r: InventoryRowWithCard) => {
    setDisposingRows([r]);
    setDisposeOpen(true);
  }, []);

  const groups = useMemo(
    () => (grouped ? groupRowsByOracleAndFoil(rows) : null),
    [rows, grouped],
  );

  const hasAnyFilter = hasAnyFilterFn({
    name: debouncedName,
    colors: colorFilter,
    type: typeFilter,
    set: setFilter,
    location: locationFilter,
    foilsOnly,
    bannedOnly,
    includeDisposed,
  });

  const selectionCards = useMemo(
    () => selectionToDeckCards(rows, selected),
    [rows, selected],
  );

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
            variant="outline"
            className="h-7 gap-1.5"
            onClick={() => setScanOpen(true)}
          >
            <ScanLine className="size-3.5" /> Scan
          </Button>
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
      <FilterBar
        nameFilter={nameFilter}
        debouncedName={debouncedName}
        onNameChange={handleNameChange}
        onNameClear={onNameClear}
        setFilter={setFilter}
        onSetChange={setSetFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        locationFilter={locationFilter}
        onLocationChange={setLocationFilter}
        locations={locations}
        colorFilter={colorFilter}
        onToggleColor={toggleColor}
        foilsOnly={foilsOnly}
        onFoilsOnlyChange={setFoilsOnly}
        bannedOnly={bannedOnly}
        onBannedOnlyChange={setBannedOnly}
        includeDisposed={includeDisposed}
        onIncludeDisposedChange={setIncludeDisposed}
        hasAnyFilter={hasAnyFilter}
        onClearAll={clearFilters}
      />

      {/* ──── Table ──── */}
      <section
        className={cn(
          "relative overflow-x-auto rounded-md border border-border-subtle bg-surface-raised transition-opacity duration-150",
          // Dim stale rows so it's obvious the table is being replaced.
          // Pointer-events stay off the overlay; the inner table is also
          // suppressed during a refetch so a user can't act on stale data.
          loading && rows.length > 0 && "opacity-60",
        )}
        aria-busy={loading || undefined}
      >
        {loading && rows.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted shadow-md shadow-black/20">
              <Loader2 className="size-3 animate-spin" />
              Refreshing
            </span>
          </div>
        )}
        {rows.length === 0 && loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            <Loader2 className="size-3 animate-spin" />
            Loading inventory…
          </div>
        ) : rows.length === 0 && !loading ? (
          <EmptyState hasFilters={hasAnyFilter} />
        ) : grouped && groups ? (
          <GroupedView
            groups={groups}
            expanded={expanded}
            selected={selected}
            onToggleExpand={toggleExpanded}
            onToggleSelected={toggleSelected}
            sortField={sortField}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            onEdit={setEditingRow}
            onDispose={onDisposeFromRow}
            onDelete={onDelete}
            onRestore={onRestore}
          />
        ) : (
          <PhysicalView
            rows={rows}
            selected={selected}
            onToggleSelected={toggleSelected}
            sortField={sortField}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            onEdit={setEditingRow}
            onDispose={onDisposeFromRow}
            onDelete={onDelete}
            onRestore={onRestore}
          />
        )}
      </section>

      {rows.length > 0 && (
        <div className="flex items-center justify-center gap-3 pb-4 font-mono text-[11px] uppercase tracking-wide text-text-muted">
          <span>
            Showing <span className="num text-text-secondary">{rows.length}</span>{" "}
            of <span className="num text-text-secondary">{totals.totalCount}</span>
          </span>
          {nextCursor && (
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              size="sm"
              className="font-mono text-[11px] uppercase tracking-wide"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onCreateDeck={() => setCreateDeckOpen(true)}
        onDispose={() => {
          const targets = rows.filter((r) => selected.has(r.id));
          setDisposingRows(targets);
          setDisposeOpen(true);
        }}
        onClear={() => setSelected(new Set())}
      />

      <EditRowDialog
        row={editingRow}
        open={editingRow !== null}
        onOpenChange={(v) => !v && setEditingRow(null)}
        onSaved={() => void refetch()}
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
        onAdded={() => void refetch()}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) refetch();
        }}
      />
      <ScanCardDialog
        open={scanOpen}
        onOpenChange={(v) => {
          setScanOpen(v);
          if (!v) refetch();
        }}
      />
      <CreateDeckFromSelectionDialog
        open={createDeckOpen}
        onOpenChange={setCreateDeckOpen}
        cards={selectionCards}
        onCreated={() => setSelected(new Set())}
      />
    </div>
  );
}
