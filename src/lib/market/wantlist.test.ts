import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { fetchWantList } from "./wantlist";

const ORACLE_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const ORACLE_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

describe("fetchWantList", () => {
  beforeEach(() => mockExecute.mockReset());

  it("returns empty when there are no manual wants and no deck shortfall", async () => {
    mockExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const list = await fetchWantList();
    expect(list).toEqual([]);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("merges manual wants with deck-need shortfall without double-counting owned copies", async () => {
    mockExecute
      .mockResolvedValueOnce([
        {
          oracle_id: ORACLE_A,
          target_quantity: 2,
          max_price_usd: "5.00",
          notes: "need foil",
          name: "Sol Ring",
          image_uri: null,
          set_code: "c21",
          current_market: "3.00",
        },
      ])
      .mockResolvedValueOnce([
        {
          deck_id: "deck-1",
          deck_name: "Deck A",
          oracle_id: ORACLE_A,
          need_qty: 2,
          owned_count: 1,
          name: "Sol Ring",
          image_uri: null,
          set_code: "c21",
          current_market: "3.00",
        },
        {
          deck_id: "deck-2",
          deck_name: "Deck B",
          oracle_id: ORACLE_A,
          need_qty: 1,
          owned_count: 1,
          name: "Sol Ring",
          image_uri: null,
          set_code: "c21",
          current_market: "3.00",
        },
      ]);

    const list = await fetchWantList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      oracleId: ORACLE_A,
      name: "Sol Ring",
      // manual 2 + global deck shortfall max(0, (2+1) - 1) = 2 → 4
      targetQuantity: 4,
      maxPriceUsd: 5,
      notes: "need foil",
      sources: ["deck_need", "manual"],
    });
    expect(list[0].contributingDecks).toHaveLength(2);
  });

  it("includes deck-only shortfall when no manual row exists", async () => {
    mockExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          deck_id: "deck-1",
          deck_name: "Mono Red",
          oracle_id: ORACLE_B,
          need_qty: 3,
          owned_count: 0,
          name: "Lightning Bolt",
          image_uri: "https://img/bolt.jpg",
          set_code: "lea",
          current_market: "2.50",
        },
      ]);

    const list = await fetchWantList();
    expect(list).toEqual([
      expect.objectContaining({
        oracleId: ORACLE_B,
        targetQuantity: 3,
        sources: ["deck_need"],
        currentMarketUsd: 2.5,
      }),
    ]);
  });
});
