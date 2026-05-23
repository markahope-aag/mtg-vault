import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SpellbookUnavailableError,
  estimateBracket,
  extractPieces,
  mapBracketTag,
} from "./spellbook";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

describe("mapBracketTag", () => {
  it("maps Spellbook bracket letters", () => {
    expect(mapBracketTag("E")).toBe(1);
    expect(mapBracketTag("C")).toBe(2);
    expect(mapBracketTag("P")).toBe(3);
    expect(mapBracketTag("S")).toBe(4);
    expect(mapBracketTag("R")).toBe(5);
    expect(mapBracketTag("B")).toBeNull();
  });
});

describe("extractPieces", () => {
  it("dedupes combo pieces from uses/cards/pieces", () => {
    const pieces = extractPieces({
      id: "1",
      uses: [{ card: { oracleId: "a", name: "Card A" } }],
      cards: [{ oracleId: "a", name: "Card A" }, { name: "Card B" }],
    });
    expect(pieces).toEqual([
      { oracleId: "a", name: "Card A" },
      { oracleId: null, name: "Card B" },
    ]);
  });
});

describe("estimateBracket", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([
      { oracle_id: "11111111-1111-4111-8111-111111111111", name: "Sol Ring" },
    ]);
  });

  it("parses Spellbook combo response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          bracketTag: "P",
          combos: [
            {
              id: "c1",
              name: "Test",
              uses: [
                { card: { name: "A" } },
                { card: { name: "B" } },
              ],
            },
          ],
        }),
      }),
    );

    const result = await estimateBracket({
      commanderOracleIds: [],
      mainOracleIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(result.spellbookBracket).toBe(3);
    expect(result.twoCardCombos).toHaveLength(1);
  });

  it("throws SpellbookUnavailableError on server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Down" }),
    );

    await expect(
      estimateBracket({
        commanderOracleIds: [],
        mainOracleIds: ["33333333-3333-4333-8333-333333333333"],
      }),
    ).rejects.toBeInstanceOf(SpellbookUnavailableError);
  });
});
