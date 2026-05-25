import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MarketListing } from "./source";

const mockExecute = vi.fn();
const mockFetchWantList = vi.fn();
const mockEnsureLoaded = vi.fn();
const mockSearch = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock("./wantlist", () => ({
  fetchWantList: () => mockFetchWantList(),
}));

vi.mock("./registry", () => ({
  ensureSourcesLoaded: () => mockEnsureLoaded(),
  marketSources: {
    all: () => [
      {
        id: "test-source",
        displayName: "Test",
        enabled: true,
        hasSoldData: false,
        rateLimit: { perMinute: 30, perDay: 1000 },
        search: mockSearch,
      },
    ],
    enabled: () => [
      {
        id: "test-source",
        displayName: "Test",
        enabled: true,
        hasSoldData: false,
        rateLimit: { perMinute: 30, perDay: 1000 },
        search: mockSearch,
      },
    ],
  },
}));

import { sweepBargains } from "./bargain-sweep";

const ORACLE = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

function listing(priceUsd: number): MarketListing {
  return {
    sourceId: "test-source",
    oracleId: null,
    rawTitle: "Sol Ring NM",
    setCode: null,
    condition: "NM",
    foil: false,
    priceUsd,
    shippingUsd: 0,
    isSold: false,
    soldAt: null,
    url: "https://example.com/x",
    confidence: 0.9,
    flags: [],
  };
}

describe("sweepBargains", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockFetchWantList.mockReset();
    mockEnsureLoaded.mockReset();
    mockSearch.mockReset();
    mockEnsureLoaded.mockResolvedValue(undefined);
  });

  it("returns empty result when the want list is empty", async () => {
    mockFetchWantList.mockResolvedValueOnce([]);
    const result = await sweepBargains();
    expect(result.bargains).toEqual([]);
    expect(result.unmetWants).toEqual([]);
    expect(result.sourceStats[0]).toMatchObject({
      sourceId: "test-source",
      listingCount: 0,
    });
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("merges source listings, assigns oracle ids, and detects bargains", async () => {
    mockFetchWantList.mockResolvedValueOnce([
      {
        oracleId: ORACLE,
        name: "Sol Ring",
        maxPriceUsd: null,
      },
    ]);
    mockExecute.mockResolvedValueOnce([
      { oracle_id: ORACLE, baseline: "10.00" },
    ]);
    mockSearch.mockResolvedValueOnce([listing(5)]);

    const result = await sweepBargains({ wantLimit: 10, perWantLimit: 5 });

    expect(mockEnsureLoaded).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sol Ring", oracleId: ORACLE, limit: 5 }),
    );
    expect(result.bargains).toHaveLength(1);
    expect(result.bargains[0].savingsUsd).toBe(5);
    expect(result.bargains[0].listing.oracleId).toBe(ORACLE);
    expect(result.unmetWants).toHaveLength(0);
    expect(result.sourceStats[0].listingCount).toBe(1);
  });

  it("surfaces unmet wants when listings do not clear the bargain threshold", async () => {
    mockFetchWantList.mockResolvedValueOnce([
      { oracleId: ORACLE, name: "Sol Ring", maxPriceUsd: null },
    ]);
    mockExecute.mockResolvedValueOnce([
      { oracle_id: ORACLE, baseline: "5.00" },
    ]);
    mockSearch.mockResolvedValueOnce([listing(4.9)]);

    const result = await sweepBargains();
    expect(result.bargains).toHaveLength(0);
    expect(result.unmetWants).toHaveLength(1);
    expect(result.unmetWants[0].oracleId).toBe(ORACLE);
  });

  it("increments errorCount when a source search throws", async () => {
    mockFetchWantList.mockResolvedValueOnce([
      { oracleId: ORACLE, name: "Sol Ring", maxPriceUsd: null },
    ]);
    mockExecute.mockResolvedValueOnce([
      { oracle_id: ORACLE, baseline: "10.00" },
    ]);
    mockSearch.mockRejectedValueOnce(new Error("network"));

    const result = await sweepBargains();
    expect(result.bargains).toHaveLength(0);
    expect(result.sourceStats[0].errorCount).toBe(1);
    expect(result.sourceStats[0].listingCount).toBe(0);
  });
});
