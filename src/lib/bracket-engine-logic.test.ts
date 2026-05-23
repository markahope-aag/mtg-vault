import { describe, expect, it } from "vitest";
import type { SpellbookCombo } from "@/lib/spellbook";
import {
  buildToReachBracketDiffs,
  evaluateBracketRules,
  pickComboPieceToRemove,
  sortByRemovalPriority,
  type FlaggedCard,
} from "./bracket-engine-logic";

function card(
  overrides: Partial<FlaggedCard> & Pick<FlaggedCard, "oracleId" | "name">,
): FlaggedCard {
  return {
    edhrecRank: null,
    usd: null,
    isGameChanger: false,
    isMassLandDenial: false,
    isExtraTurn: false,
    isTutor: false,
    ...overrides,
  };
}

describe("sortByRemovalPriority", () => {
  it("sorts higher (worse) EDHREC rank first, then lower price", () => {
    const sorted = sortByRemovalPriority([
      card({ oracleId: "a", name: "A", edhrecRank: 100, usd: 5 }),
      card({ oracleId: "b", name: "B", edhrecRank: 500, usd: 1 }),
      card({ oracleId: "c", name: "C", edhrecRank: 500, usd: 10 }),
    ]);
    expect(sorted.map((c) => c.oracleId)).toEqual(["c", "b", "a"]);
  });
});

describe("pickComboPieceToRemove", () => {
  it("prefers the cheapest piece by USD", () => {
    const flagged = new Map<string, FlaggedCard>([
      ["p1", card({ oracleId: "p1", name: "Piece 1", usd: 20 })],
      ["p2", card({ oracleId: "p2", name: "Piece 2", usd: 2 })],
    ]);
    const combo: SpellbookCombo = {
      id: "c1",
      name: "Test Combo",
      resultText: "Win",
      pieces: [
        { oracleId: "p1", name: "Piece 1" },
        { oracleId: "p2", name: "Piece 2" },
      ],
    };

    const removal = pickComboPieceToRemove(combo, flagged, new Set());
    expect(removal?.oracleId).toBe("p2");
    expect(removal?.reason).toContain("Breaks 2-card combo");
  });

  it("reuses a piece already marked for removal", () => {
    const flagged = new Map<string, FlaggedCard>([
      ["p1", card({ oracleId: "p1", name: "Piece 1", usd: 20 })],
      ["p2", card({ oracleId: "p2", name: "Piece 2", usd: 2 })],
    ]);
    const combo: SpellbookCombo = {
      id: "c1",
      name: "Test Combo",
      resultText: "Win",
      pieces: [
        { oracleId: "p1", name: "Piece 1" },
        { oracleId: "p2", name: "Piece 2" },
      ],
    };

    const removal = pickComboPieceToRemove(combo, flagged, new Set(["p1"]));
    expect(removal?.oracleId).toBe("p1");
    expect(removal?.reason).toContain("Already removed");
  });
});

describe("evaluateBracketRules", () => {
  it("returns Bracket 5 when declared cEDH", () => {
    const result = evaluateBracketRules({
      declaredAsCedh: true,
      gameChangers: [],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(5);
    expect(result.confidence).toBe("declared");
  });

  it("returns Bracket 2 for a clean deck", () => {
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(2);
    expect(result.confidence).toBe("calculated");
  });

  it("returns Bracket 3 for a single game changer", () => {
    const result = evaluateBracketRules({
      gameChangers: [card({ oracleId: "gc", name: "Dockside", isGameChanger: true })],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(3);
  });

  it("returns Bracket 4 for more than three game changers", () => {
    const gcs = ["a", "b", "c", "d"].map((id) =>
      card({ oracleId: id, name: id, isGameChanger: true }),
    );
    const result = evaluateBracketRules({
      gameChangers: gcs,
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(4);
  });

  it("returns Bracket 4 when a two-card combo is present", () => {
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [
        {
          id: "combo-1",
          name: "Thoracle",
          resultText: "Win",
          pieces: [
            { oracleId: "p1", name: "A" },
            { oracleId: "p2", name: "B" },
          ],
        },
      ],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(4);
  });

  it("marks confidence conservative when Spellbook is unavailable", () => {
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: false,
    });
    expect(result.confidence).toBe("conservative");
    expect(result.reasons.some((r) => r.text.includes("Spellbook"))).toBe(true);
  });

  it("returns Bracket 3 for mass land denial", () => {
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [card({ oracleId: "mld", name: "Armageddon", isMassLandDenial: true })],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(3);
    expect(result.reasons.some((r) => r.category === "mass-land-denial")).toBe(
      true,
    );
  });

  it("returns Bracket 3 for three or more extra-turn cards", () => {
    const extraTurns = ["e1", "e2", "e3"].map((id) =>
      card({ oracleId: id, name: id, isExtraTurn: true }),
    );
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [],
      extraTurns,
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(3);
    expect(result.reasons.some((r) => r.category === "extra-turns")).toBe(true);
  });

  it("returns Bracket 3 for multi-card combos without hitting Bracket 4", () => {
    const result = evaluateBracketRules({
      gameChangers: [],
      mld: [],
      extraTurns: [],
      tutorCount: 0,
      twoCardCombos: [],
      multiCardCombos: [
        {
          id: "mc1",
          name: "Kiki combo",
          resultText: "Infinite",
          pieces: [
            { oracleId: "p1", name: "A" },
            { oracleId: "p2", name: "B" },
            { oracleId: "p3", name: "C" },
          ],
        },
      ],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(3);
    expect(result.reasons.some((r) => r.category === "multi-card-combos")).toBe(
      true,
    );
  });

  it("surfaces cEDH-shaped hint at Bracket 4", () => {
    const gcs = Array.from({ length: 5 }, (_, i) =>
      card({ oracleId: `gc${i}`, name: `GC${i}`, isGameChanger: true }),
    );
    const result = evaluateBracketRules({
      gameChangers: gcs,
      mld: [],
      extraTurns: [],
      tutorCount: 5,
      twoCardCombos: [
        {
          id: "c1",
          name: "Combo",
          resultText: "Win",
          pieces: [
            { oracleId: "p1", name: "A" },
            { oracleId: "p2", name: "B" },
          ],
        },
      ],
      multiCardCombos: [],
      spellbookAvailable: true,
    });
    expect(result.bracket).toBe(4);
    expect(
      result.reasons.some((r) => r.text.includes("cEDH-level characteristics")),
    ).toBe(true);
  });
});

describe("buildToReachBracketDiffs", () => {
  it("lists game changers to reach Bracket 2", () => {
    const gc = card({ oracleId: "gc", name: "Dockside", isGameChanger: true });
    const diffs = buildToReachBracketDiffs({
      bracket: 3,
      gameChangers: [gc],
      mld: [],
      extraTurns: [],
      twoCardCombos: [],
      flagged: new Map([["gc", gc]]),
    });
    expect(diffs[2]?.remove).toEqual([
      {
        oracleId: "gc",
        name: "Dockside",
        reason: "Game Changer — not allowed in Bracket 2.",
      },
    ]);
  });

  it("suggests dropping excess game changers to reach Bracket 3", () => {
    const gcs = [
      card({ oracleId: "a", name: "A", isGameChanger: true, edhrecRank: 10 }),
      card({ oracleId: "b", name: "B", isGameChanger: true, edhrecRank: 20 }),
      card({ oracleId: "c", name: "C", isGameChanger: true, edhrecRank: 30 }),
      card({ oracleId: "d", name: "D", isGameChanger: true, edhrecRank: 40 }),
    ];
    const flagged = new Map(gcs.map((c) => [c.oracleId, c]));
    const diffs = buildToReachBracketDiffs({
      bracket: 4,
      gameChangers: gcs,
      mld: [],
      extraTurns: [],
      twoCardCombos: [],
      flagged,
    });
    expect(diffs[3]?.remove).toHaveLength(1);
    expect(diffs[3]?.remove[0].oracleId).toBe("d");
  });

  it("always includes a Bracket 1 note", () => {
    const diffs = buildToReachBracketDiffs({
      bracket: 2,
      gameChangers: [],
      mld: [],
      extraTurns: [],
      twoCardCombos: [],
      flagged: new Map(),
    });
    expect(diffs[1]?.note).toContain("Bracket 1");
  });

  it("suggests extra-turn removals down to two cards", () => {
    const extraTurns = ["e1", "e2", "e3", "e4"].map((id, i) =>
      card({
        oracleId: id,
        name: id,
        isExtraTurn: true,
        edhrecRank: (i + 1) * 100,
      }),
    );
    const flagged = new Map(extraTurns.map((c) => [c.oracleId, c]));
    const diffs = buildToReachBracketDiffs({
      bracket: 3,
      gameChangers: [],
      mld: [],
      extraTurns,
      twoCardCombos: [],
      flagged,
    });
    expect(diffs[2]?.remove.filter((r) => r.reason.includes("Extra turn"))).toHaveLength(2);
  });
});
