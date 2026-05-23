import { describe, expect, it } from "vitest";
import { detectBargains } from "./bargains";
import type { MarketListing } from "./source";

function listing(over: Partial<MarketListing> = {}): MarketListing {
  return {
    sourceId: "test",
    oracleId: "card-1",
    rawTitle: "Sol Ring NM",
    setCode: "c21",
    condition: "NM",
    foil: false,
    priceUsd: 1.0,
    shippingUsd: 0,
    isSold: false,
    soldAt: null,
    url: "https://example.com/x",
    confidence: 0.9,
    flags: [],
    ...over,
  };
}

const wants = [{ oracleId: "card-1", name: "Sol Ring", maxPriceUsd: null }];

function input(
  listings: MarketListing[],
  baseline = 5,
  extras: Partial<Parameters<typeof detectBargains>[0]> = {},
) {
  return {
    wants,
    baselineByOracle: new Map([["card-1", baseline]]),
    listingsByOracle: new Map([["card-1", listings]]),
    ...extras,
  };
}

describe("detectBargains", () => {
  it("flags listings under baseline by both percent and dollar minimums", () => {
    const bs = detectBargains(input([listing({ priceUsd: 2.0 })], 5));
    expect(bs).toHaveLength(1);
    expect(bs[0].savingsUsd).toBe(3);
    expect(bs[0].savingsPct).toBe(60);
  });

  it("requires either minSavingsPct OR minSavingsUsd", () => {
    // 14% off a $200 card = $28 → hits dollar minimum (>= $2) even
    // though percent is below default 15%.
    const bs = detectBargains(input([listing({ priceUsd: 172 })], 200));
    expect(bs).toHaveLength(1);
  });

  it("ignores tiny absolute savings on cheap cards", () => {
    // 50% off $1 = $0.50 — fails both minSavingsUsd ($2) and the test
    // doesn't bother with minSavingsPct override.
    const bs = detectBargains(
      input([listing({ priceUsd: 0.5 })], 1, { minSavingsPct: 80 }),
    );
    expect(bs).toHaveLength(0);
  });

  it("includes shipping in the total cost", () => {
    // $3.00 + $5 shipping = $8 total, baseline $5 → no bargain
    const bs = detectBargains(
      input([listing({ priceUsd: 3, shippingUsd: 5 })], 5),
    );
    expect(bs).toHaveLength(0);
  });

  it("respects the manual maxPriceUsd ceiling", () => {
    // Listing at $4 total, baseline $10 — would be a bargain ($6 savings)
    // except the user said no above $3.
    const bs = detectBargains({
      wants: [{ oracleId: "card-1", name: "Sol Ring", maxPriceUsd: 3 }],
      baselineByOracle: new Map([["card-1", 10]]),
      listingsByOracle: new Map([["card-1", [listing({ priceUsd: 4 })]]]),
    });
    expect(bs).toHaveLength(0);
  });

  it("drops listings below the confidence floor", () => {
    const bs = detectBargains(
      input([listing({ priceUsd: 2, confidence: 0.3 })], 5),
    );
    expect(bs).toHaveLength(0);
  });

  it("drops listings with excluded flags", () => {
    const bs = detectBargains(
      input([listing({ priceUsd: 2, flags: ["graded"] })], 5),
    );
    expect(bs).toHaveLength(0);
  });

  it("can include flagged listings if the caller opts out of the default exclusion", () => {
    // Allow lots through (the user wants to see them anyway).
    const bs = detectBargains(
      input([listing({ priceUsd: 2, flags: ["possible_lot"] })], 5, {
        excludeFlags: [],
      }),
    );
    expect(bs).toHaveLength(1);
  });

  it("sorts results by absolute savings descending", () => {
    // Two oracle ids, different savings. Bigger absolute saving first.
    const wants2 = [
      { oracleId: "card-1", name: "Sol Ring", maxPriceUsd: null },
      { oracleId: "card-2", name: "Force of Will", maxPriceUsd: null },
    ];
    const bs = detectBargains({
      wants: wants2,
      baselineByOracle: new Map([
        ["card-1", 5],
        ["card-2", 100],
      ]),
      listingsByOracle: new Map([
        ["card-1", [listing({ priceUsd: 2, oracleId: "card-1" })]],
        [
          "card-2",
          [
            listing({
              priceUsd: 60,
              oracleId: "card-2",
              rawTitle: "Force of Will NM",
            }),
          ],
        ],
      ]),
    });
    expect(bs).toHaveLength(2);
    expect(bs[0].name).toBe("Force of Will");
    expect(bs[1].name).toBe("Sol Ring");
  });

  it("skips wants with no baseline", () => {
    const bs = detectBargains({
      wants,
      baselineByOracle: new Map(),
      listingsByOracle: new Map([["card-1", [listing({ priceUsd: 1 })]]]),
    });
    expect(bs).toHaveLength(0);
  });

  it("skips wants with no listings", () => {
    const bs = detectBargains({
      wants,
      baselineByOracle: new Map([["card-1", 5]]),
      listingsByOracle: new Map(),
    });
    expect(bs).toHaveLength(0);
  });
});
