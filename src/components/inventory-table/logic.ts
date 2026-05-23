import {
  INVENTORY_PAGE_SIZE,
  currentValueOf,
  type InventoryRowWithCard,
} from "@/lib/inventory/types";

// ─── Sort + filter state shapes ────────────────────────────────

export type SortField =
  | "name"
  | "cmc"
  | "usd"
  | "acquiredAt"
  | "condition"
  | "location"
  | "createdAt";

export type SortDir = "asc" | "desc";

export type InventorySortState = {
  field: SortField;
  dir: SortDir;
};

export type InventoryFilterState = {
  name: string;
  colors: ReadonlySet<string>;
  type: string;
  set: string;
  location: string;
  foilsOnly: boolean;
  bannedOnly: boolean;
  includeDisposed: boolean;
};

export const INITIAL_FILTERS: InventoryFilterState = {
  name: "",
  colors: new Set(),
  type: "",
  set: "",
  location: "",
  foilsOnly: false,
  bannedOnly: false,
  includeDisposed: false,
};

// ─── Sort toggle ────────────────────────────────────────────────

// Clicking the same column flips direction. Switching columns picks a
// sensible default direction: name is asc (alphabetical), everything else is
// desc (biggest values first). Returning a new object keeps React state
// updates referentially honest.
export function toggleSort(
  state: InventorySortState,
  field: SortField,
): InventorySortState {
  if (state.field === field) {
    return { field, dir: state.dir === "asc" ? "desc" : "asc" };
  }
  return { field, dir: field === "name" ? "asc" : "desc" };
}

// ─── Set toggle ─────────────────────────────────────────────────

// Toggle-in/out helper that returns a fresh Set so React state updates aren't
// missed. Used for color filters, row selection, and group expansion — three
// independent sites that all had the same six-line useState pattern.
export function toggleInSet<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

// ─── URL params builder ─────────────────────────────────────────

// Translates the filter + sort state into the URLSearchParams that
// /api/inventory expects. Pure so the test suite can pin the URL shape;
// every filter has its own assertion.
export function buildInventoryParams(
  filters: InventoryFilterState,
  sort: InventorySortState,
  options: { limit?: number; cursor?: string | null } = {},
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("limit", String(options.limit ?? INVENTORY_PAGE_SIZE));
  if (options.cursor) p.set("cursor", options.cursor);
  p.set("sort", sort.field);
  p.set("dir", sort.dir);
  const trimmedName = filters.name.trim();
  if (trimmedName) p.set("filter[name]", trimmedName);
  if (filters.colors.size > 0)
    p.set("filter[colors]", [...filters.colors].join(","));
  if (filters.type) p.set("filter[type]", filters.type);
  const trimmedSet = filters.set.trim();
  if (trimmedSet) p.set("filter[set]", trimmedSet);
  if (filters.location) p.set("filter[location]", filters.location);
  if (filters.foilsOnly) p.set("filter[foilOnly]", "true");
  if (filters.bannedOnly) p.set("filter[bannedOnly]", "true");
  if (filters.includeDisposed) p.set("filter[includeDisposed]", "true");
  return p;
}

// ─── hasAnyFilter ───────────────────────────────────────────────

// `includeDisposed` is intentionally excluded — it's a "show more" toggle,
// not a search refinement. The Clear filters button should leave it alone.
export function hasAnyFilter(filters: InventoryFilterState): boolean {
  return (
    filters.name.trim().length > 0 ||
    filters.colors.size > 0 ||
    filters.type.length > 0 ||
    filters.set.trim().length > 0 ||
    filters.location.length > 0 ||
    filters.foilsOnly ||
    filters.bannedOnly
  );
}

// ─── Grouping ───────────────────────────────────────────────────

export type InventoryGroup = {
  key: string;
  oracleId: string;
  foil: boolean;
  name: string;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
  setCode: string;
  rarity: string | null;
  isCommanderLegal: boolean | null;
  rows: InventoryRowWithCard[];
  totalValue: number;
  locationsCount: Map<string, number>;
  anyDisposed: boolean;
};

// Collapse the row list into one row per (oracleId, foil) pair — the
// grouped view's source of truth. Each group carries a per-location count
// so we can render location dots without an extra pass, and aggregates a
// finish-aware total value via currentValueOf.
export function groupRowsByOracleAndFoil(
  rows: InventoryRowWithCard[],
): InventoryGroup[] {
  const map = new Map<string, InventoryGroup>();
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
        isCommanderLegal: r.isCommanderLegal,
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
}

// ─── Selection → deck cards ─────────────────────────────────────

export type SelectionDeckCard = {
  printingId: string;
  quantity: number;
};

// Commander is a singleton format, so non-basic selections cap at quantity 1
// even if the user picked multiple physical copies. Basic lands keep the
// real count (capped at the format max of 99). Both directions matter:
// silently capping basics at 1 was a bug we hit when the user tried to add
// 15 Mountains to a new deck.
export function selectionToDeckCards(
  rows: InventoryRowWithCard[],
  selectedIds: ReadonlySet<string>,
): SelectionDeckCard[] {
  const byPrinting = new Map<
    string,
    { printingId: string; quantity: number; isBasic: boolean }
  >();
  for (const r of rows) {
    if (!selectedIds.has(r.id)) continue;
    const isBasic = /Basic Land/i.test(r.typeLine ?? "");
    const entry = byPrinting.get(r.printingId);
    if (entry) entry.quantity += 1;
    else
      byPrinting.set(r.printingId, {
        printingId: r.printingId,
        quantity: 1,
        isBasic,
      });
  }
  return [...byPrinting.values()].map((e) => ({
    printingId: e.printingId,
    quantity: e.isBasic ? Math.min(e.quantity, 99) : 1,
  }));
}
