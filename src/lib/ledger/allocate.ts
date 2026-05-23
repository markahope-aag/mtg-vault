/**
 * Cost-basis allocation for multi-line transactions.
 *
 * When someone buys 10 cards for $50 in one transaction, the basis is split
 * proportionally to each card's market value at time of purchase — so a $40
 * card absorbs more basis than a $1 card. Same idea for sales (proceeds
 * proportional to market value) and trades (each line's basis = its market
 * value, the standard tax treatment for like-kind asset swaps).
 *
 * Per-line overrides always win. The default allocation only fills slots
 * the caller didn't pin manually.
 *
 * Rounding: results are quantized to cents; the remainder (positive or
 * negative) lands on the line with the largest computed allocation so the
 * sum equals the input cash exactly.
 */
export type AllocationLine = {
  direction: "in" | "out";
  marketValueAtTime: number; // dollars (e.g. 12.50)
  allocatedValueOverride?: number; // per-line manual override
};

export type AllocationInput = {
  kind: "purchase" | "sale" | "trade";
  cashOutUsd?: number;
  cashInUsd?: number;
  lines: AllocationLine[];
};

/**
 * Returns one allocatedValue per input line, in input order.
 *
 * Semantics by kind:
 *   purchase — cashOutUsd allocated across 'in' lines proportionally to
 *              marketValueAtTime. 'out' lines (if any) get their market
 *              value.
 *   sale     — cashInUsd allocated across 'out' lines proportionally to
 *              marketValueAtTime. 'in' lines get their market value.
 *   trade    — every line's allocatedValue defaults to its marketValueAtTime
 *              (the standard like-kind basis treatment). Header cash legs
 *              don't allocate per-card; they show up in the header P&L.
 *
 * Manual overrides win in every case.
 */
export function allocateCost(input: AllocationInput): number[] {
  const result = new Array<number>(input.lines.length).fill(0);

  // Two independent allocations: one for 'in', one for 'out'.
  for (const direction of ["in", "out"] as const) {
    const indexedLines = input.lines
      .map((line, idx) => ({ line, idx }))
      .filter((l) => l.line.direction === direction);
    if (indexedLines.length === 0) continue;

    // Cash to allocate across THIS direction. Trades: no cash allocation
    // per-line (each line uses marketValueAtTime).
    let cashTarget = 0;
    if (input.kind === "purchase" && direction === "in") {
      cashTarget = input.cashOutUsd ?? 0;
    } else if (input.kind === "sale" && direction === "out") {
      cashTarget = input.cashInUsd ?? 0;
    }

    // Pin overridden lines first; their values are sacred.
    let overrideSum = 0;
    const remaining: typeof indexedLines = [];
    for (const item of indexedLines) {
      if (item.line.allocatedValueOverride != null) {
        result[item.idx] = round2(item.line.allocatedValueOverride);
        overrideSum += result[item.idx];
      } else {
        remaining.push(item);
      }
    }
    if (remaining.length === 0) continue;

    // If there's no cash leg for this direction (trade, or zero cash on a
    // sale's 'in' lines / purchase's 'out' lines), fall back to
    // marketValueAtTime as the per-line basis.
    if (cashTarget === 0) {
      for (const item of remaining) {
        result[item.idx] = round2(item.line.marketValueAtTime);
      }
      continue;
    }

    const remainingCash = cashTarget - overrideSum;
    const totalMarket = remaining.reduce(
      (s, item) => s + item.line.marketValueAtTime,
      0,
    );

    if (totalMarket > 0) {
      for (const item of remaining) {
        const share = item.line.marketValueAtTime / totalMarket;
        result[item.idx] = round2(remainingCash * share);
      }
    } else {
      // Every market value is zero — split the cash evenly so we still
      // attribute basis somewhere instead of leaving lines at $0.
      const each = remainingCash / remaining.length;
      for (const item of remaining) {
        result[item.idx] = round2(each);
      }
    }

    // Fix rounding drift. Send the remainder to the line with the largest
    // computed allocation so it lands on the most significant value rather
    // than a $0.01 card.
    const sumNow = remaining.reduce((s, item) => s + result[item.idx], 0);
    const drift = round2(remainingCash - sumNow);
    if (drift !== 0) {
      const topIdx = remaining
        .slice()
        .sort((a, b) => result[b.idx] - result[a.idx])[0].idx;
      result[topIdx] = round2(result[topIdx] + drift);
    }
  }

  return result;
}

function round2(n: number): number {
  // toFixed → number conversion handles -0 cleanly. Math.round directly
  // sometimes carries float drift past two decimals.
  return Math.round(n * 100) / 100;
}

/**
 * Realized P&L for a single transaction.
 *
 * - purchase: nothing realized; the basis just sits on the new inventory.
 * - sale: proceeds (cashInUsd - feesUsd) - sum of out-line basis.
 *   Out-line basis comes from the linked inventory row's acquired_price.
 * - trade: (cashIn + sum of in-line market value) -
 *          (cashOut + sum of out-line basis from inventory.acquired_price)
 *   Out lines that didn't have an acquired_price on the inventory row
 *   (e.g. pack pulls) are treated as $0 basis — flagged as such by the
 *   caller if needed.
 */
export type PnLInput = {
  kind: "purchase" | "sale" | "trade";
  cashInUsd: number;
  cashOutUsd: number;
  feesUsd: number;
  lines: Array<{
    direction: "in" | "out";
    /** For 'in': market value at trade time (basis). For 'out': basis
     *  from inventory.acquired_price (cost when you got it). */
    basisUsd: number;
    /** Allocation result from allocateCost — proceeds (out) or new
     *  basis (in). */
    allocatedValueUsd: number;
  }>;
};

export function realizedPnL(input: PnLInput): {
  realizedUsd: number;
  proceedsUsd: number;
  basisUsd: number;
} {
  if (input.kind === "purchase") {
    return { realizedUsd: 0, proceedsUsd: 0, basisUsd: 0 };
  }
  if (input.kind === "sale") {
    const proceeds = input.cashInUsd - input.feesUsd;
    const basis = input.lines
      .filter((l) => l.direction === "out")
      .reduce((s, l) => s + l.basisUsd, 0);
    return {
      realizedUsd: round2(proceeds - basis),
      proceedsUsd: round2(proceeds),
      basisUsd: round2(basis),
    };
  }
  // trade
  const proceeds =
    input.cashInUsd -
    input.feesUsd +
    input.lines
      .filter((l) => l.direction === "in")
      .reduce((s, l) => s + l.allocatedValueUsd, 0); // basis of cards in = "proceeds" of disposal
  const basis =
    input.cashOutUsd +
    input.lines
      .filter((l) => l.direction === "out")
      .reduce((s, l) => s + l.basisUsd, 0);
  return {
    realizedUsd: round2(proceeds - basis),
    proceedsUsd: round2(proceeds),
    basisUsd: round2(basis),
  };
}
