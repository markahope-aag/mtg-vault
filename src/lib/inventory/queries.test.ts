import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { listInventory } from "./queries";

describe("listInventory", () => {
  beforeEach(() => mockExecute.mockReset());

  it("returns rows and total from the database", async () => {
    mockExecute
      .mockResolvedValueOnce([
        {
          id: "inv-1",
          printing_id: "print-1",
          foil: false,
          etched: false,
          condition: "NM",
          language: "en",
          location: null,
          physical_id: null,
          acquired_price: null,
          acquired_at: null,
          purchased_from: null,
          grading_company: null,
          grade: null,
          notes: null,
          disposed_to: null,
          disposed_price: null,
          disposed_at: null,
          created_at: new Date("2024-01-01"),
          updated_at: new Date("2024-01-01"),
          oracle_id: "oracle-1",
          name: "Sol Ring",
          mana_cost: "{2}",
          cmc: "1.0",
          type_line: "Artifact",
          color_identity: [],
          is_commander_legal: true,
          set_code: "cmr",
          set_name: "Commander Legends",
          collector_number: "472",
          rarity: "uncommon",
          usd: "1.00",
          usd_foil: "3.00",
          usd_etched: null,
          image_uri: null,
        },
      ])
      .mockResolvedValueOnce([{ total_count: 1, total_value: "1.00" }]);

    const result = await listInventory({
      filters: {},
      sort: "createdAt",
      direction: "desc",
      offset: 0,
      limit: 50,
    });

    expect(result.totalCount).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Sol Ring");
  });

  it("applies foil-only filter via SQL", async () => {
    mockExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total_count: 0, total_value: "0" }]);
    await listInventory({
      filters: { foilOnly: true },
      sort: "name",
      direction: "asc",
      offset: 0,
      limit: 10,
    });
    expect(String(mockExecute.mock.calls[0][0])).toContain("foil");
  });
});
