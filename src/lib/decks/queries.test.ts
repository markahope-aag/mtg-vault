import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { fetchDeckDetail, listDecks } from "./queries";

describe("listDecks", () => {
  beforeEach(() => mockExecute.mockReset());

  it("maps deck list rows", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        id: "deck-1",
        name: "Atraxa",
        commander_printing_id: null,
        partner_printing_id: null,
        target_bracket: 3,
        archetype: "Counters",
        notes: null,
        is_primary: true,
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-02"),
        commander_name: "Atraxa, Praetors' Voice",
        commander_image_uri: null,
        partner_name: null,
        color_identity: ["G", "U", "W", "B"],
        total_cards: 100,
        total_value: "250.00",
      },
    ]);

    const rows = await listDecks({
      sort: "name",
      direction: "asc",
      filters: {},
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Atraxa");
    expect(rows[0].totalCards).toBe(100);
  });
});

describe("fetchDeckDetail", () => {
  beforeEach(() => mockExecute.mockReset());

  it("returns null when deck is missing", async () => {
    mockExecute.mockResolvedValueOnce([]);
    const detail = await fetchDeckDetail("missing");
    expect(detail).toBeNull();
  });
});
