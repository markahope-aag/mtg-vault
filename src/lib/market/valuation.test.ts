import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import {
  appreciatedCards,
  topMovers,
  underwaterCards,
} from "./valuation";

describe("appreciatedCards", () => {
  beforeEach(() => mockExecute.mockReset());

  it("maps SQL rows to AppreciatedRow shape", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        inventory_id: "inv-1",
        oracle_id: "ora-1",
        name: "Sol Ring",
        set_code: "c21",
        set_name: "Commander 2021",
        collector_number: "263",
        image_uri: "https://img/sol.jpg",
        foil: false,
        condition: "NM",
        acquired_price: "1.00",
        current_market: "5.00",
        gain_usd: "4.00",
        gain_pct: "400.00",
      },
    ]);

    const rows = await appreciatedCards({ minGainPct: 25, minGainUsd: 1, limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      inventoryId: "inv-1",
      oracleId: "ora-1",
      name: "Sol Ring",
      acquiredPriceUsd: 1,
      currentMarketUsd: 5,
      gainUsd: 4,
      gainPct: 400,
    });
  });

  it("passes threshold options through to the query", async () => {
    mockExecute.mockResolvedValueOnce([]);
    await appreciatedCards({ minGainPct: 50, minGainUsd: 5, limit: 3 });
    expect(mockExecute).toHaveBeenCalledOnce();
  });
});

describe("topMovers", () => {
  beforeEach(() => mockExecute.mockReset());

  it("maps mover rows and parses numeric fields", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        oracle_id: "ora-2",
        name: "Dockside Extortionist",
        set_code: "c19",
        set_name: "Commander 2019",
        collector_number: "24",
        image_uri: null,
        price_from: "5.00",
        price_to: "8.50",
        delta: "3.50",
        delta_pct: "70.00",
        owned_count: 2,
      },
    ]);

    const rows = await topMovers({ days: 7, limit: 5, direction: "up" });
    expect(rows[0]).toMatchObject({
      oracleId: "ora-2",
      priceFromUsd: 5,
      priceToUsd: 8.5,
      deltaUsd: 3.5,
      deltaPct: 70,
      ownedCount: 2,
    });
  });

  it("supports direction filters", async () => {
    mockExecute.mockResolvedValueOnce([]);
    await topMovers({ direction: "down" });
    mockExecute.mockResolvedValueOnce([]);
    await topMovers({ direction: "either" });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});

describe("underwaterCards", () => {
  beforeEach(() => mockExecute.mockReset());

  it("maps underwater rows", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        inventory_id: "inv-3",
        oracle_id: "ora-3",
        name: "Chase Card",
        set_code: "mh2",
        image_uri: null,
        foil: true,
        acquired_price: "50.00",
        current_market: "30.00",
        loss_usd: "20.00",
        loss_pct: "40.00",
      },
    ]);

    const rows = await underwaterCards({ minLossPct: 10, limit: 20 });
    expect(rows[0]).toMatchObject({
      inventoryId: "inv-3",
      foil: true,
      acquiredPriceUsd: 50,
      currentMarketUsd: 30,
      lossUsd: 20,
      lossPct: 40,
    });
  });
});
