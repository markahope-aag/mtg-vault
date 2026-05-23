import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NormalizedRow } from "./types";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { resolvePrinting } from "./resolver";

function row(overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    sourceRowIndex: 1,
    name: "Sol Ring",
    setCode: "cmr",
    collectorNumber: "472",
    quantity: 1,
    foil: false,
    _raw: {},
    ...overrides,
  };
}

function printing(
  overrides: Partial<{
    id: string;
    oracle_id: string;
    set_code: string;
    collector_number: string;
    name: string;
    released_at: Date | null;
  }> = {},
) {
  return {
    id: "print-1",
    oracle_id: "oracle-1",
    set_code: "cmr",
    set_name: "Commander Legends",
    collector_number: "472",
    rarity: "uncommon",
    usd: "1.50",
    usd_foil: "3.00",
    image_uri: null,
    released_at: new Date("2020-11-20"),
    name: "Sol Ring",
    ...overrides,
  };
}

describe("resolvePrinting", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("matches by Scryfall ID when present", async () => {
    mockExecute.mockResolvedValueOnce([printing({ id: "sf-id-123" })]);

    const result = await resolvePrinting(
      row({ scryfallId: "sf-id-123" }),
    );

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.printing.id).toBe("sf-id-123");
    }
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("falls through when Scryfall ID lookup misses", async () => {
    mockExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([printing()]);

    const result = await resolvePrinting(
      row({ scryfallId: "missing", setCode: "cmr", collectorNumber: "472" }),
    );

    expect(result.status).toBe("matched");
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("matches by set code + collector number", async () => {
    mockExecute.mockResolvedValueOnce([printing()]);

    const result = await resolvePrinting(row());

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.printing.setCode).toBe("cmr");
    }
  });

  it("returns ambiguous when set + collector matches multiple printings", async () => {
    mockExecute.mockResolvedValueOnce([
      printing({
        id: "a",
        collector_number: "472",
        released_at: new Date("2020-01-01"),
      }),
      printing({
        id: "b",
        collector_number: "472a",
        released_at: new Date("2021-01-01"),
      }),
    ]);

    const result = await resolvePrinting(row({ collectorNumber: "472" }));

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].printing.id).toBe("a");
      expect(result.candidates[0].score).toBeGreaterThan(
        result.candidates[1].score,
      );
    }
  });

  it("matches by name + set when collector lookup fails", async () => {
    mockExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([printing({ name: "Sol Ring" })]);

    const result = await resolvePrinting(
      row({ setCode: "cmr", collectorNumber: "999" }),
    );

    expect(result.status).toBe("matched");
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("returns ambiguous for name-only when multiple printings exist", async () => {
    mockExecute.mockResolvedValueOnce([
      printing({ id: "neo", set_code: "neo", name: "Lightning Bolt" }),
      printing({ id: "2xm", set_code: "2xm", name: "Lightning Bolt" }),
    ]);

    const result = await resolvePrinting(
      row({ setCode: "", collectorNumber: "", name: "Lightning Bolt" }),
    );

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.length).toBe(2);
    }
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns unmatched when nothing resolves", async () => {
    mockExecute.mockResolvedValue([]);

    const result = await resolvePrinting(
      row({ name: "Totally Fake Card", setCode: "", collectorNumber: "" }),
    );

    expect(result).toEqual({
      status: "unmatched",
      reason: "card name not found",
    });
  });
});
