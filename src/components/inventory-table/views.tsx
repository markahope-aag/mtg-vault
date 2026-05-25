"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManaCost } from "@/components/mana-cost";
import { SetSymbol } from "@/components/set-symbol";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { currentValueOf } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import type { SortField } from "./logic";
import type { groupRowsByOracleAndFoil } from "./logic";
import { SortHeader, Thumb } from "./parts";

// The two table renderers (grouped + physical) and their row
// sub-renderers. Both are pure presentational — the parent owns
// state and passes in callbacks.

type Group = ReturnType<typeof groupRowsByOracleAndFoil>[number];

type RowCallbacks = {
  onEdit: (row: InventoryRowWithCard) => void;
  onDispose: (row: InventoryRowWithCard) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
};

type SortProps = {
  sortField: SortField;
  sortDir: "asc" | "desc";
  onToggleSort: (f: SortField) => void;
};

// ─── Grouped view ────────────────────────────────────────────────

export function GroupedView({
  groups,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelected,
  sortField,
  sortDir,
  onToggleSort,
  ...rowCb
}: {
  groups: Group[];
  expanded: Set<string>;
  selected: Set<string>;
  onToggleExpand: (key: string) => void;
  onToggleSelected: (id: string) => void;
} & SortProps &
  RowCallbacks) {
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b border-border-subtle bg-surface-inset/60">
        <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <th className="w-8 px-2 py-1.5"></th>
          <th className="w-12 px-2 py-1.5"></th>
          <SortHeader
            field="name"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="px-2 py-1.5 text-left"
          >
            Card
          </SortHeader>
          <th className="px-2 py-1.5 text-left">Type</th>
          <th className="w-20 px-2 py-1.5 text-left">Sets</th>
          <th className="w-12 px-2 py-1.5 text-left">Finish</th>
          <th className="w-16 px-2 py-1.5 text-right">Qty</th>
          <SortHeader
            field="usd"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="w-24 px-2 py-1.5 text-right"
          >
            Value
          </SortHeader>
          <SortHeader
            field="location"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="px-2 py-1.5 text-left"
          >
            Locations
          </SortHeader>
          <th className="w-8 px-2 py-1.5"></th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRow
            key={g.key}
            group={g}
            isOpen={expanded.has(g.key)}
            onToggleExpand={() => onToggleExpand(g.key)}
            selected={selected}
            onToggleSelected={onToggleSelected}
            {...rowCb}
          />
        ))}
      </tbody>
    </table>
  );
}

function GroupRow({
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
  group: Group;
  isOpen: boolean;
  onToggleExpand: () => void;
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
} & RowCallbacks) {
  const locs = [...group.locationsCount.entries()].sort((a, b) => b[1] - a[1]);

  // Distinct printings in this group — a group spans one card+finish but may
  // hold copies from several sets. The set symbol is the only way to tell
  // printings apart at a glance.
  const setEntries = (() => {
    const map = new Map<
      string,
      { setCode: string; rarity: string | null; count: number }
    >();
    for (const r of group.rows) {
      const existing = map.get(r.setCode);
      if (existing) existing.count += 1;
      else
        map.set(r.setCode, {
          setCode: r.setCode,
          rarity: r.rarity,
          count: 1,
        });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  return (
    <>
      <tr
        // content-visibility:auto lets the browser skip layout + paint
        // for off-screen rows once the collection grows past a few
        // hundred entries. contain-intrinsic-size reserves an estimated
        // height so scroll position stays stable when rows are
        // collapsed. ⌘+F search still surfaces hidden rows
        // (per the content-visibility spec), and AT can reach them.
        // ~37px is the measured row height for the grouped table.
        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 37px" }}
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
              className="font-medium text-text-primary hover:underline"
            >
              {group.name}
            </Link>
            <ManaCost cost={group.manaCost} size="xs" />
            {group.isCommanderLegal === false && (
              <span className="rounded-sm border border-[var(--value-negative)]/40 bg-[var(--value-negative)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--value-negative)]">
                Banned
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          {group.typeLine?.split("—")[0]?.trim() ?? "—"}
        </td>
        <td className="px-2 py-1.5">
          <span className="inline-flex items-center gap-1">
            {setEntries.slice(0, 4).map((s) => (
              <span
                key={s.setCode}
                className="inline-flex items-center"
                title={
                  setEntries.length > 1
                    ? `${s.setCode.toUpperCase()} ×${s.count}`
                    : s.setCode.toUpperCase()
                }
              >
                <SetSymbol setCode={s.setCode} rarity={s.rarity} size="sm" />
              </span>
            ))}
            {setEntries.length > 4 && (
              <span className="font-mono text-[10px] text-text-muted">
                +{setEntries.length - 4}
              </span>
            )}
          </span>
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
          <GroupChildRow
            key={r.id}
            row={r}
            selected={selected.has(r.id)}
            onToggleSelected={() => onToggleSelected(r.id)}
            onEdit={() => onEdit(r)}
            onDispose={() => onDispose(r)}
            onDelete={() => onDelete(r.id)}
            onRestore={() => onRestore(r.id)}
          />
        ))}
    </>
  );
}

/**
 * One physical copy shown under an expanded group. Its cells line up with
 * the grouped table's 10-column header (checkbox · indicator · Card · Type ·
 * Sets · Finish · Qty · Value · Locations · actions) — the per-copy paid
 * price is folded into the Value cell so there's no orphaned column.
 */
function GroupChildRow({
  row,
  selected,
  onToggleSelected,
  onEdit,
  onDispose,
  onDelete,
  onRestore,
}: {
  row: InventoryRowWithCard;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDispose: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const disposed = !!row.disposedAt;
  const paid = row.acquiredPrice ? Number(row.acquiredPrice) : null;
  return (
    <tr
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 33px" }}
      className={cn(
        "group/row border-b border-border-subtle bg-surface-inset/30 transition-colors hover:bg-surface-inset/60",
        disposed && "opacity-55",
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
        <span
          className="ml-2 inline-block h-6 w-1 rounded-full bg-border-subtle"
          aria-hidden
        />
      </td>
      <td className="px-2 py-1">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-text-secondary">{row.setName}</span>
          <span className="font-mono text-[10px] tabular-nums text-text-muted">
            #{row.collectorNumber}
          </span>
          <span className="rounded-sm border border-border-subtle bg-surface-base px-1 font-mono text-[9px] uppercase tracking-wide text-text-secondary">
            {row.condition}
          </span>
          {row.isCommanderLegal === false && (
            <span className="rounded-sm border border-[var(--value-negative)]/40 bg-[var(--value-negative)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--value-negative)]">
              Banned
            </span>
          )}
          {disposed && (
            <span className="rounded-sm border border-border-strong bg-surface-inset px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              Disposed
            </span>
          )}
        </span>
      </td>
      <td className="px-2 py-1"></td>
      <td className="px-2 py-1">
        <span className="inline-flex items-center gap-1.5">
          <SetSymbol setCode={row.setCode} rarity={row.rarity} size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
            {row.setCode}
          </span>
        </span>
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
      <td className="px-2 py-1 text-right">
        <span className="num text-text-muted">×1</span>
      </td>
      <td className="px-2 py-1 text-right">
        <span className="num text-text-primary">
          ${currentValueOf(row).toFixed(2)}
        </span>
        {paid != null && (
          <span className="num block text-[10px] text-text-muted">
            paid ${paid.toFixed(2)}
          </span>
        )}
      </td>
      <td className="px-2 py-1 font-mono text-[11px] text-text-muted">
        {row.location ?? <span className="text-text-muted">—</span>}
      </td>
      <td className="px-2 py-1">
        <RowMenu
          disposed={disposed}
          onEdit={onEdit}
          onDispose={onDispose}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      </td>
    </tr>
  );
}

// ─── Physical view ───────────────────────────────────────────────

export function PhysicalView({
  rows,
  selected,
  onToggleSelected,
  sortField,
  sortDir,
  onToggleSort,
  ...rowCb
}: {
  rows: InventoryRowWithCard[];
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
} & SortProps &
  RowCallbacks) {
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b border-border-subtle bg-surface-inset/60">
        <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <th className="w-8 px-2 py-1.5"></th>
          <th className="w-12 px-2 py-1.5"></th>
          <SortHeader
            field="name"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
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
            onSort={onToggleSort}
            className="w-14 px-2 py-1.5 text-left"
          >
            Cond
          </SortHeader>
          <SortHeader
            field="location"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="px-2 py-1.5 text-left"
          >
            Location
          </SortHeader>
          <SortHeader
            field="usd"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="w-20 px-2 py-1.5 text-right"
          >
            USD
          </SortHeader>
          <SortHeader
            field="acquiredAt"
            current={sortField}
            dir={sortDir}
            onSort={onToggleSort}
            className="w-20 px-2 py-1.5 text-right"
          >
            Paid
          </SortHeader>
          <th className="w-8 px-2 py-1.5"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <PhysicalRow
            key={r.id}
            row={r}
            selected={selected.has(r.id)}
            onToggleSelected={() => onToggleSelected(r.id)}
            onEdit={() => rowCb.onEdit(r)}
            onDispose={() => rowCb.onDispose(r)}
            onDelete={() => rowCb.onDelete(r.id)}
            onRestore={() => rowCb.onRestore(r.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

function PhysicalRow({
  row,
  selected,
  onToggleSelected,
  onEdit,
  onDispose,
  onDelete,
  onRestore,
}: {
  row: InventoryRowWithCard;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDispose: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const disposed = !!row.disposedAt;
  return (
    <tr
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 33px" }}
      className={cn(
        "group/row border-b border-border-subtle transition-colors hover:bg-surface-inset/40",
        disposed && "opacity-55",
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
        <Thumb src={row.imageUri} alt={row.name} />
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cards/${row.oracleId}`}
            className="font-medium text-text-primary hover:underline"
          >
            {row.name}
          </Link>
          <ManaCost cost={row.manaCost} size="xs" />
          {row.isCommanderLegal === false && (
            <span className="rounded-sm border border-[var(--value-negative)]/40 bg-[var(--value-negative)]/15 px-1 font-mono text-[9px] uppercase tracking-wide text-[var(--value-negative)]">
              Banned
            </span>
          )}
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
        <RowMenu
          disposed={disposed}
          onEdit={onEdit}
          onDispose={onDispose}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      </td>
    </tr>
  );
}

// ─── Shared row-action menu ──────────────────────────────────────

function RowMenu({
  disposed,
  onEdit,
  onDispose,
  onDelete,
  onRestore,
}: {
  disposed: boolean;
  onEdit: () => void;
  onDispose: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-6 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary data-[state=open]:bg-surface-inset data-[state=open]:text-text-primary"
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
  );
}
