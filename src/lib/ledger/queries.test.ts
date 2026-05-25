import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { fetchLedgerSummary } from "./queries";

describe("fetchLedgerSummary", () => {
  beforeEach(() => mockExecute.mockReset());

  function queueTxnAndLines(
    txns: Array<{
      id: string;
      kind: "purchase" | "sale" | "trade";
      occurred_at: string;
      counterparty?: string | null;
      cash_in_usd?: string | null;
      cash_out_usd?: string | null;
      fees_usd?: string | null;
    }>,
    lines: Array<{
      transaction_id: string;
      direction: "in" | "out";
      allocated_value_usd?: string | null;
      acquired_price?: string | null;
    }>,
  ) {
    mockExecute.mockResolvedValueOnce(txns).mockResolvedValueOnce(lines);
  }

  it("returns empty aggregates when there are no transactions", async () => {
    queueTxnAndLines([], []);
    const summary = await fetchLedgerSummary();
    expect(summary.lifetime.transactionCount).toBe(0);
    expect(summary.lifetime.realizedUsd).toBe(0);
    expect(summary.byYear).toEqual([]);
    expect(summary.byCounterparty).toEqual([]);
  });

  it("aggregates lifetime P&L, kind counts, by-year, and by counterparty", async () => {
    queueTxnAndLines(
      [
        {
          id: "t-purchase",
          kind: "purchase",
          occurred_at: "2023-06-15T12:00:00Z",
          counterparty: "LGS",
          cash_out_usd: "50.00",
        },
        {
          id: "t-sale",
          kind: "sale",
          occurred_at: "2024-03-10T12:00:00Z",
          counterparty: "Buyer",
          cash_in_usd: "100.00",
          fees_usd: "10.00",
        },
        {
          id: "t-trade",
          kind: "trade",
          occurred_at: "2024-08-01T12:00:00Z",
          counterparty: null,
          cash_out_usd: "5.00",
        },
      ],
      [
        {
          transaction_id: "t-purchase",
          direction: "in",
          allocated_value_usd: "50.00",
        },
        {
          transaction_id: "t-sale",
          direction: "out",
          allocated_value_usd: "85.00",
          acquired_price: "60.00",
        },
        {
          transaction_id: "t-trade",
          direction: "out",
          allocated_value_usd: "30.00",
          acquired_price: "20.00",
        },
        {
          transaction_id: "t-trade",
          direction: "in",
          allocated_value_usd: "25.00",
        },
        {
          transaction_id: "t-trade",
          direction: "in",
          allocated_value_usd: "10.00",
        },
      ],
    );

    const summary = await fetchLedgerSummary();

    expect(summary.lifetime.transactionCount).toBe(3);
    expect(summary.lifetime.purchaseCount).toBe(1);
    expect(summary.lifetime.saleCount).toBe(1);
    expect(summary.lifetime.tradeCount).toBe(1);
    // Sale: (100-10) - 60 = 30. Trade: (0+35) - (5+20) = 10.
    expect(summary.lifetime.realizedUsd).toBe(40);
    expect(summary.lifetime.proceedsUsd).toBe(125);
    expect(summary.lifetime.basisUsd).toBe(85);

    expect(summary.byYear).toEqual([
      { year: 2024, realizedUsd: 40, transactionCount: 2 },
      { year: 2023, realizedUsd: 0, transactionCount: 1 },
    ]);

    expect(summary.byCounterparty).toEqual(
      expect.arrayContaining([
        { counterparty: "Buyer", transactionCount: 1, realizedUsd: 30 },
        { counterparty: "LGS", transactionCount: 1, realizedUsd: 0 },
      ]),
    );
  });

  it("treats missing line rows as zero allocation and basis", async () => {
    queueTxnAndLines(
      [
        {
          id: "t-sale",
          kind: "sale",
          occurred_at: "2024-01-01T00:00:00Z",
          cash_in_usd: "20.00",
        },
      ],
      [],
    );

    const summary = await fetchLedgerSummary();
    // No out lines → basis 0, proceeds 20, realized 20.
    expect(summary.lifetime.realizedUsd).toBe(20);
  });

  it("issues two SQL queries (transactions, then lines)", async () => {
    queueTxnAndLines([], []);
    await fetchLedgerSummary();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
