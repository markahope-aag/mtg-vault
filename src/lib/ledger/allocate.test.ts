import { describe, expect, it } from "vitest";
import {
  allocateCost,
  realizedPnL,
  type AllocationLine,
} from "./allocate";

function inLine(marketValueAtTime: number, override?: number): AllocationLine {
  return { direction: "in", marketValueAtTime, allocatedValueOverride: override };
}
function outLine(marketValueAtTime: number, override?: number): AllocationLine {
  return { direction: "out", marketValueAtTime, allocatedValueOverride: override };
}

describe("allocateCost — purchase", () => {
  it("splits cash proportionally to market value across in lines", () => {
    // $55 of market value bought for $50 cash. Shares 40/10/5.
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 50,
      lines: [inLine(40), inLine(10), inLine(5)],
    });
    expect(r).toEqual([36.36, 9.09, 4.55]);
    // Sum is exactly the cash paid, drift parked on the largest line.
    expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(50, 2);
  });

  it("returns market value for any 'out' lines (purchases shouldn't have them, but defensive)", () => {
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 50,
      lines: [inLine(40), outLine(10)],
    });
    expect(r[0]).toBe(50);
    expect(r[1]).toBe(10);
  });

  it("respects per-line overrides and allocates only the remainder", () => {
    // Three cards; one pinned at $30. Remaining $20 split 10/10 (50/50 of
    // the remaining $20 across two equal-market-value lines).
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 50,
      lines: [inLine(40, 30), inLine(10), inLine(10)],
    });
    expect(r[0]).toBe(30);
    expect(r[1]).toBe(10);
    expect(r[2]).toBe(10);
  });

  it("falls back to even split when every market value is zero", () => {
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 30,
      lines: [inLine(0), inLine(0), inLine(0)],
    });
    expect(r).toEqual([10, 10, 10]);
  });

  it("handles a single-line purchase cleanly", () => {
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 17.5,
      lines: [inLine(20)],
    });
    expect(r).toEqual([17.5]);
  });

  it("absorbs rounding drift into the largest allocated line", () => {
    // 3 cards at $10/$10/$10 for $100 — even at 33.33/33.33/33.33 the sum
    // is $99.99. The leftover penny lands on the first line (largest).
    const r = allocateCost({
      kind: "purchase",
      cashOutUsd: 100,
      lines: [inLine(10), inLine(10), inLine(10)],
    });
    expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
  });
});

describe("allocateCost — sale", () => {
  it("splits cash proportionally across out lines", () => {
    const r = allocateCost({
      kind: "sale",
      cashInUsd: 50,
      lines: [outLine(40), outLine(10), outLine(5)],
    });
    expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(50, 2);
    expect(r[0]).toBeGreaterThan(r[1]);
    expect(r[1]).toBeGreaterThan(r[2]);
  });

  it("doesn't allocate sale cash onto 'in' lines (purchases shouldn't fund the same txn)", () => {
    const r = allocateCost({
      kind: "sale",
      cashInUsd: 50,
      lines: [outLine(50), inLine(10)],
    });
    expect(r[0]).toBe(50);
    expect(r[1]).toBe(10); // falls back to market value
  });
});

describe("allocateCost — trade", () => {
  it("uses marketValueAtTime as the per-line basis ignoring cash legs", () => {
    // Trade $40 of cards for $30 of cards plus $10 cash, e.g.
    // Each line keeps its market value as basis; cash sits on the header.
    const r = allocateCost({
      kind: "trade",
      cashOutUsd: 10,
      lines: [outLine(40), inLine(30)],
    });
    expect(r).toEqual([40, 30]);
  });

  it("respects overrides on a trade line", () => {
    const r = allocateCost({
      kind: "trade",
      cashOutUsd: 0,
      lines: [outLine(40, 35), inLine(30)],
    });
    expect(r[0]).toBe(35);
    expect(r[1]).toBe(30);
  });
});

describe("realizedPnL", () => {
  it("returns zero for purchases (basis sits on inventory, nothing realized)", () => {
    const r = realizedPnL({
      kind: "purchase",
      cashInUsd: 0,
      cashOutUsd: 50,
      feesUsd: 0,
      lines: [{ direction: "in", basisUsd: 50, allocatedValueUsd: 50 }],
    });
    expect(r).toEqual({ realizedUsd: 0, proceedsUsd: 0, basisUsd: 0 });
  });

  it("computes sale P&L as (cashIn - fees) - sum(out basis)", () => {
    // Sold 2 cards for $100 net of $10 fees, originally cost $60 total.
    const r = realizedPnL({
      kind: "sale",
      cashInUsd: 100,
      cashOutUsd: 0,
      feesUsd: 10,
      lines: [
        { direction: "out", basisUsd: 40, allocatedValueUsd: 70 },
        { direction: "out", basisUsd: 20, allocatedValueUsd: 30 },
      ],
    });
    expect(r.proceedsUsd).toBe(90);
    expect(r.basisUsd).toBe(60);
    expect(r.realizedUsd).toBe(30);
  });

  it("computes trade P&L as (cashIn + in-side market value) - (cashOut + out-side basis)", () => {
    // Trade out a card with $20 basis (current market $30) for two cards
    // worth $25 + $10 plus give the other side $5 cash.
    const r = realizedPnL({
      kind: "trade",
      cashInUsd: 0,
      cashOutUsd: 5,
      feesUsd: 0,
      lines: [
        { direction: "out", basisUsd: 20, allocatedValueUsd: 30 },
        { direction: "in", basisUsd: 25, allocatedValueUsd: 25 },
        { direction: "in", basisUsd: 10, allocatedValueUsd: 10 },
      ],
    });
    // Proceeds = 0 + (25 + 10) = 35. Basis = 5 + 20 = 25. Realized = 10.
    expect(r.proceedsUsd).toBe(35);
    expect(r.basisUsd).toBe(25);
    expect(r.realizedUsd).toBe(10);
  });

  it("subtracts fees from sale proceeds", () => {
    const r = realizedPnL({
      kind: "sale",
      cashInUsd: 100,
      cashOutUsd: 0,
      feesUsd: 15,
      lines: [{ direction: "out", basisUsd: 30, allocatedValueUsd: 85 }],
    });
    expect(r.realizedUsd).toBe(55); // (100-15) - 30
  });
});
