import { describe, expect, it } from "vitest";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import {
  buildInventoryParams,
  groupRowsByOracleAndFoil,
  hasAnyFilter,
  INITIAL_FILTERS,
  selectionToDeckCards,
  toggleInSet,
  toggleSort,
  type InventoryFilterState,
  type InventorySortState,
} from "./logic";

// Test fixture: minimal-but-valid InventoryRowWithCard. Tests override
// specific fields per case rather than constructing one from scratch each
// time — keeps assertions readable.
function row(overrides: Partial<InventoryRowWithCard> = {}): InventoryRowWithCard {
  return {
    id: "row-1",
    printingId: "printing-1",
    foil: false,
    etched: false,
    condition: "NM",
    language: "en",
    location: null,
    physicalId: null,
    acquiredPrice: null,
    acquiredAt: null,
    purchasedFrom: null,
    gradingCompany: null,
    grade: null,
    notes: null,
    disposedTo: null,
    disposedPrice: null,
    disposedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    oracleId: "oracle-1",
    name: "Lightning Bolt",
    manaCost: "{R}",
    typeLine: "Instant",
    colorIdentity: ["R"],
    cmc: "1",
    isCommanderLegal: true,
    setCode: "lea",
    setName: "Limited Edition Alpha",
    collectorNumber: "162",
    rarity: "common",
    usd: "1.00",
    usdFoil: null,
    usdEtched: null,
    imageUri: null,
    ...overrides,
  };
}

describe("toggleSort", () => {
  it("flips direction when the same field is clicked", () => {
    const state: InventorySortState = { field: "name", dir: "asc" };
    expect(toggleSort(state, "name")).toEqual({ field: "name", dir: "desc" });
    expect(toggleSort({ field: "name", dir: "desc" }, "name")).toEqual({
      field: "name",
      dir: "asc",
    });
  });

  it("switches to a new field with asc for name, desc for everything else", () => {
    const state: InventorySortState = { field: "createdAt", dir: "desc" };
    expect(toggleSort(state, "name")).toEqual({ field: "name", dir: "asc" });
    expect(toggleSort(state, "usd")).toEqual({ field: "usd", dir: "desc" });
    expect(toggleSort(state, "cmc")).toEqual({ field: "cmc", dir: "desc" });
  });

  it("returns a fresh object so React notices the update", () => {
    const state: InventorySortState = { field: "name", dir: "asc" };
    expect(toggleSort(state, "name")).not.toBe(state);
  });
});

describe("toggleInSet", () => {
  it("adds an item that isn't present", () => {
    const next = toggleInSet(new Set(["a"]), "b");
    expect([...next].sort()).toEqual(["a", "b"]);
  });

  it("removes an item that is present", () => {
    const next = toggleInSet(new Set(["a", "b"]), "a");
    expect([...next]).toEqual(["b"]);
  });

  it("returns a fresh Set so React state updates aren't missed", () => {
    const original = new Set(["a"]);
    const next = toggleInSet(original, "b");
    expect(next).not.toBe(original);
    expect([...original]).toEqual(["a"]);
  });
});

describe("buildInventoryParams", () => {
  const sort: InventorySortState = { field: "createdAt", dir: "desc" };

  it("emits limit, sort, and dir even with no filters", () => {
    const p = buildInventoryParams(INITIAL_FILTERS, sort);
    expect(p.get("limit")).toBe("200");
    expect(p.get("sort")).toBe("createdAt");
    expect(p.get("dir")).toBe("desc");
    expect(p.get("filter[name]")).toBeNull();
  });

  it("respects explicit limit and cursor", () => {
    const p = buildInventoryParams(INITIAL_FILTERS, sort, {
      limit: 50,
      cursor: "abc",
    });
    expect(p.get("limit")).toBe("50");
    expect(p.get("cursor")).toBe("abc");
  });

  it("trims whitespace-only name and set inputs", () => {
    const filters: InventoryFilterState = {
      ...INITIAL_FILTERS,
      name: "   ",
      set: "   ",
    };
    const p = buildInventoryParams(filters, sort);
    expect(p.get("filter[name]")).toBeNull();
    expect(p.get("filter[set]")).toBeNull();
  });

  it("encodes each filter when set", () => {
    const filters: InventoryFilterState = {
      name: "  Sol Ring  ",
      colors: new Set(["W", "U"]),
      type: "Creature",
      set: " LEA ",
      location: "Trade Binder",
      foilsOnly: true,
      bannedOnly: true,
      includeDisposed: true,
    };
    const p = buildInventoryParams(filters, sort);
    expect(p.get("filter[name]")).toBe("Sol Ring");
    expect(p.get("filter[colors]")).toBe("W,U");
    expect(p.get("filter[type]")).toBe("Creature");
    expect(p.get("filter[set]")).toBe("LEA");
    expect(p.get("filter[location]")).toBe("Trade Binder");
    expect(p.get("filter[foilOnly]")).toBe("true");
    expect(p.get("filter[bannedOnly]")).toBe("true");
    expect(p.get("filter[includeDisposed]")).toBe("true");
  });
});

describe("hasAnyFilter", () => {
  it("returns false for the initial state", () => {
    expect(hasAnyFilter(INITIAL_FILTERS)).toBe(false);
  });

  it("treats whitespace-only name/set inputs as empty", () => {
    expect(
      hasAnyFilter({ ...INITIAL_FILTERS, name: "   ", set: "   " }),
    ).toBe(false);
  });

  it("returns true for each individual filter", () => {
    expect(hasAnyFilter({ ...INITIAL_FILTERS, name: "Bolt" })).toBe(true);
    expect(
      hasAnyFilter({ ...INITIAL_FILTERS, colors: new Set(["R"]) }),
    ).toBe(true);
    expect(hasAnyFilter({ ...INITIAL_FILTERS, type: "Creature" })).toBe(true);
    expect(hasAnyFilter({ ...INITIAL_FILTERS, set: "lea" })).toBe(true);
    expect(hasAnyFilter({ ...INITIAL_FILTERS, location: "Box" })).toBe(true);
    expect(hasAnyFilter({ ...INITIAL_FILTERS, foilsOnly: true })).toBe(true);
    expect(hasAnyFilter({ ...INITIAL_FILTERS, bannedOnly: true })).toBe(true);
  });

  it("ignores includeDisposed — it's not a search refinement", () => {
    expect(
      hasAnyFilter({ ...INITIAL_FILTERS, includeDisposed: true }),
    ).toBe(false);
  });
});

describe("groupRowsByOracleAndFoil", () => {
  it("collapses copies sharing (oracleId, foil) into one group", () => {
    const groups = groupRowsByOracleAndFoil([
      row({ id: "r1", oracleId: "bolt", foil: false }),
      row({ id: "r2", oracleId: "bolt", foil: false }),
      row({ id: "r3", oracleId: "bolt", foil: true }),
    ]);
    expect(groups).toHaveLength(2);
    const nonFoil = groups.find((g) => !g.foil)!;
    const foil = groups.find((g) => g.foil)!;
    expect(nonFoil.rows).toHaveLength(2);
    expect(foil.rows).toHaveLength(1);
  });

  it("counts locations and flags disposed groups", () => {
    const groups = groupRowsByOracleAndFoil([
      row({ id: "r1", oracleId: "bolt", location: "Binder A" }),
      row({ id: "r2", oracleId: "bolt", location: "Binder A" }),
      row({ id: "r3", oracleId: "bolt", location: "Box B" }),
      row({
        id: "r4",
        oracleId: "bolt",
        location: "Box B",
        disposedAt: "2026-05-01T00:00:00Z",
      }),
    ]);
    expect(groups).toHaveLength(1);
    const [g] = groups;
    expect(g.locationsCount.get("Binder A")).toBe(2);
    expect(g.locationsCount.get("Box B")).toBe(2);
    expect(g.anyDisposed).toBe(true);
  });

  it("aggregates finish-aware totalValue", () => {
    const groups = groupRowsByOracleAndFoil([
      row({ id: "r1", oracleId: "bolt", foil: false, usd: "1.00" }),
      row({ id: "r2", oracleId: "bolt", foil: false, usd: "1.00" }),
      row({ id: "r3", oracleId: "bolt", foil: true, usd: "1.00", usdFoil: "5.00" }),
    ]);
    const nonFoil = groups.find((g) => !g.foil)!;
    const foil = groups.find((g) => g.foil)!;
    expect(nonFoil.totalValue).toBe(2);
    expect(foil.totalValue).toBe(5);
  });
});

describe("selectionToDeckCards", () => {
  it("returns an empty list when nothing is selected", () => {
    expect(selectionToDeckCards([row()], new Set())).toEqual([]);
  });

  it("caps non-basic selections at quantity 1 per printing", () => {
    const rows = [
      row({ id: "a", printingId: "p1", typeLine: "Instant" }),
      row({ id: "b", printingId: "p1", typeLine: "Instant" }),
      row({ id: "c", printingId: "p1", typeLine: "Instant" }),
    ];
    const result = selectionToDeckCards(rows, new Set(["a", "b", "c"]));
    expect(result).toEqual([{ printingId: "p1", quantity: 1 }]);
  });

  it("preserves the count for basic lands (capped at 99)", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({
        id: `m${i}`,
        printingId: "mountain",
        typeLine: "Basic Land — Mountain",
      }),
    );
    const result = selectionToDeckCards(
      rows,
      new Set(rows.map((r) => r.id)),
    );
    expect(result).toEqual([{ printingId: "mountain", quantity: 15 }]);
  });

  it("caps basics at 99 to respect Commander format max", () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      row({
        id: `p${i}`,
        printingId: "plains",
        typeLine: "Basic Land — Plains",
      }),
    );
    const result = selectionToDeckCards(
      rows,
      new Set(rows.map((r) => r.id)),
    );
    expect(result).toEqual([{ printingId: "plains", quantity: 99 }]);
  });

  it("handles a mix of basics and non-basics across different printings", () => {
    const rows = [
      row({ id: "a", printingId: "bolt", typeLine: "Instant" }),
      row({ id: "b", printingId: "bolt", typeLine: "Instant" }),
      row({ id: "c", printingId: "mountain", typeLine: "Basic Land — Mountain" }),
      row({ id: "d", printingId: "mountain", typeLine: "Basic Land — Mountain" }),
    ];
    const result = selectionToDeckCards(rows, new Set(["a", "b", "c", "d"]));
    expect(result).toEqual(
      expect.arrayContaining([
        { printingId: "bolt", quantity: 1 },
        { printingId: "mountain", quantity: 2 },
      ]),
    );
    expect(result).toHaveLength(2);
  });
});
