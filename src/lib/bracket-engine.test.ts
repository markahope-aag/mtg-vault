import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockEstimateBracket = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock("@/lib/spellbook", () => ({
  estimateBracket: (...args: unknown[]) => mockEstimateBracket(...args),
  SpellbookUnavailableError: class SpellbookUnavailableError extends Error {
    name = "SpellbookUnavailableError";
  },
}));

import { calculateBracket } from "./bracket-engine";

const ORACLE_GC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function flaggedRow(overrides: Partial<{
  oracle_id: string;
  name: string;
  is_game_changer: boolean;
  is_mass_land_denial: boolean;
  is_extra_turn: boolean;
  is_tutor: boolean;
}> = {}) {
  return {
    oracle_id: ORACLE_GC,
    name: "Dockside Extortionist",
    edhrec_rank: 50,
    is_game_changer: true,
    is_mass_land_denial: false,
    is_extra_turn: false,
    is_tutor: false,
    min_usd: "5.00",
    ...overrides,
  };
}

describe("calculateBracket", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockEstimateBracket.mockReset();
    mockEstimateBracket.mockResolvedValue({
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookBracket: null,
      spellbookBracketTag: null,
    });
  });

  it("wires DB flags and Spellbook into bracket 3 for a game changer", async () => {
    mockExecute.mockResolvedValueOnce([flaggedRow()]);

    const result = await calculateBracket({
      deckId: "deck-1",
      cards: [{ oracleId: ORACLE_GC, quantity: 1 }],
      commanderOracleIds: [],
      commanderColorIdentity: ["U", "R"],
    });

    expect(result.bracket).toBe(3);
    expect(result.metrics.gameChangerCount).toBe(1);
    expect(result.spellbookAvailable).toBe(true);
    expect(mockEstimateBracket).toHaveBeenCalledWith({
      commanderOracleIds: [],
      mainOracleIds: [ORACLE_GC],
    });
  });

  it("degrades gracefully when Spellbook is unavailable", async () => {
    const { SpellbookUnavailableError } = await import("@/lib/spellbook");
    mockExecute.mockResolvedValueOnce([]);
    mockEstimateBracket.mockRejectedValueOnce(
      new SpellbookUnavailableError("down"),
    );

    const result = await calculateBracket({
      deckId: "deck-1",
      cards: [],
      commanderOracleIds: [],
      commanderColorIdentity: [],
    });

    expect(result.bracket).toBe(2);
    expect(result.confidence).toBe("conservative");
    expect(result.spellbookAvailable).toBe(false);
  });

  it("includes deck size from card quantities and commanders", async () => {
    mockExecute.mockResolvedValueOnce([]);

    const result = await calculateBracket({
      deckId: "deck-1",
      cards: [
        { oracleId: "11111111-1111-1111-1111-111111111111", quantity: 4 },
        { oracleId: "22222222-2222-2222-2222-222222222222", quantity: 35 },
      ],
      commanderOracleIds: ["33333333-3333-3333-3333-333333333333"],
      commanderColorIdentity: ["G"],
    });

    expect(result.metrics.deckSize).toBe(40);
  });
});
