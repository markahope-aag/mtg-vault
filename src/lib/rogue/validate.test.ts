import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { validateDeck } from "./validate";

// validateDeck issues two queries in order:
//   1) bulk card lookup by lower(name) IN (...)
//   2) commander row by oracle_id
// Helper to queue both responses for one call.
function queueLookups(opts: {
  cards: Array<Partial<{
    oracle_id: string;
    name: string;
    type_line: string | null;
    color_identity: string[] | null;
    is_commander_legal: boolean | null;
    is_game_changer: boolean | null;
    is_mass_land_denial: boolean | null;
    is_extra_turn: boolean | null;
  }>>;
  commander: { oracle_id: string; color_identity: string[] };
}) {
  mockExecute
    .mockResolvedValueOnce(
      opts.cards.map((c) => ({
        oracle_id: c.oracle_id ?? "unknown",
        name: c.name ?? "Unknown",
        type_line: c.type_line ?? "Creature",
        color_identity: c.color_identity ?? [],
        is_commander_legal: c.is_commander_legal ?? true,
        is_game_changer: c.is_game_changer ?? false,
        is_mass_land_denial: c.is_mass_land_denial ?? false,
        is_extra_turn: c.is_extra_turn ?? false,
      })),
    )
    .mockResolvedValueOnce([
      {
        oracle_id: opts.commander.oracle_id,
        name: "Commander",
        color_identity: opts.commander.color_identity,
      },
    ]);
}

// A common-shape valid deck: 99 cards under a mono-red commander, no
// flagged behaviors. We override specific cards per test.
function makeBolt(n: number) {
  return {
    oracle_id: `oracle-${n}`,
    name: `Card ${n}`,
    type_line: "Instant",
    color_identity: ["R"] as string[],
    is_commander_legal: true,
  };
}

describe("validateDeck", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("returns clean when every rule passes", async () => {
    // 99 distinct R cards.
    const cards = Array.from({ length: 99 }, (_, i) => makeBolt(i + 1));
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    expect(result.violations).toEqual([]);
    expect(result.isClean).toBe(true);
    expect(result.metrics.cardCount).toBe(99);
  });

  it("flags unresolved card names (likely AI hallucinations)", async () => {
    // 98 known cards + 1 imaginary name (the DB returns no row for it).
    const cards = Array.from({ length: 98 }, (_, i) => makeBolt(i + 1));
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const names = [...cards.map((c) => c.name), "Hallucinated Card of Lies"];
    const result = await validateDeck(names, "cmd", 3);
    const unresolved = result.violations.filter((v) => v.type === "unresolved");
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].cardName).toBe("Hallucinated Card of Lies");
  });

  it("flags off-color cards against the commander's identity", async () => {
    const cards = [
      ...Array.from({ length: 98 }, (_, i) => makeBolt(i + 1)),
      {
        ...makeBolt(99),
        name: "Counterspell",
        color_identity: ["U"], // not in mono-red commander
      },
    ];
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    const offColor = result.violations.filter((v) => v.type === "off_color");
    expect(offColor.map((v) => v.cardName)).toEqual(["Counterspell"]);
  });

  it("flags illegal (banned / not-Commander-legal) cards", async () => {
    const cards = [
      ...Array.from({ length: 98 }, (_, i) => makeBolt(i + 1)),
      { ...makeBolt(99), name: "Black Lotus", is_commander_legal: false },
    ];
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    expect(
      result.violations.filter((v) => v.type === "illegal").map((v) => v.cardName),
    ).toEqual(["Black Lotus"]);
  });

  it("flags duplicates of non-basic, non-any-number-allowed cards", async () => {
    // 98 distinct + Sol Ring listed twice.
    const distinct = Array.from({ length: 98 }, (_, i) => makeBolt(i + 1));
    const solRing = {
      ...makeBolt(99),
      name: "Sol Ring",
      type_line: "Artifact",
    };
    queueLookups({
      cards: [...distinct, solRing],
      commander: { oracle_id: "cmd", color_identity: ["R"] },
    });
    const result = await validateDeck(
      [...distinct.map((c) => c.name), "Sol Ring", "Sol Ring"],
      "cmd",
      3,
    );
    const dup = result.violations.filter(
      (v) => v.type === "duplicate_nonbasic",
    );
    expect(dup.map((v) => v.cardName)).toEqual(["Sol Ring"]);
  });

  it("does NOT flag duplicate basics", async () => {
    // 60 Mountain + 39 distinct = 99 names but Mountain dup is legal.
    const mountain = {
      ...makeBolt(1),
      name: "Mountain",
      type_line: "Basic Land — Mountain",
    };
    const distinct = Array.from({ length: 39 }, (_, i) => makeBolt(i + 2));
    queueLookups({
      cards: [mountain, ...distinct],
      commander: { oracle_id: "cmd", color_identity: ["R"] },
    });
    const names = [
      ...Array(60).fill("Mountain"),
      ...distinct.map((c) => c.name),
    ];
    const result = await validateDeck(names, "cmd", 3);
    expect(
      result.violations.filter((v) => v.type === "duplicate_nonbasic"),
    ).toEqual([]);
    expect(result.metrics.landCount).toBe(60);
  });

  it("does NOT flag duplicate Rat Colony (any-number-allowed exception)", async () => {
    const rat = {
      ...makeBolt(1),
      name: "Rat Colony",
      type_line: "Creature — Rat",
      color_identity: [] as string[],
    };
    const distinct = Array.from({ length: 49 }, (_, i) => makeBolt(i + 2));
    queueLookups({
      cards: [rat, ...distinct],
      commander: { oracle_id: "cmd", color_identity: ["R"] },
    });
    const names = [
      ...Array(50).fill("Rat Colony"),
      ...distinct.map((c) => c.name),
    ];
    const result = await validateDeck(names, "cmd", 3);
    expect(
      result.violations.filter((v) => v.type === "duplicate_nonbasic"),
    ).toEqual([]);
  });

  it("enforces bracket-2 Game Changer cap (max 0)", async () => {
    const cards = [
      ...Array.from({ length: 98 }, (_, i) => makeBolt(i + 1)),
      { ...makeBolt(99), name: "Mana Vault", is_game_changer: true },
    ];
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      2,
    );
    expect(
      result.violations.map((v) => v.type),
    ).toContain("gamechanger_over_bracket");
  });

  it("allows Game Changers at bracket 3 up to the cap of 3", async () => {
    // 96 plain + 3 game changers.
    const cards = [
      ...Array.from({ length: 96 }, (_, i) => makeBolt(i + 1)),
      ...Array.from({ length: 3 }, (_, i) => ({
        ...makeBolt(100 + i),
        is_game_changer: true,
      })),
    ];
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    expect(
      result.violations.filter((v) => v.type === "gamechanger_over_bracket"),
    ).toEqual([]);
    expect(result.metrics.gameChangerCount).toBe(3);
  });

  it("enforces bracket-2 MLD = 0", async () => {
    const cards = [
      ...Array.from({ length: 98 }, (_, i) => makeBolt(i + 1)),
      { ...makeBolt(99), name: "Armageddon", is_mass_land_denial: true },
    ];
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      2,
    );
    expect(
      result.violations.map((v) => v.type),
    ).toContain("mld_over_bracket");
  });

  it("flags wrong card count", async () => {
    const cards = Array.from({ length: 50 }, (_, i) => makeBolt(i + 1));
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    expect(
      result.violations.find((v) => v.type === "wrong_count"),
    ).toBeDefined();
  });

  it("tolerates 98 cards (partner-commander shape) without flagging count", async () => {
    const cards = Array.from({ length: 98 }, (_, i) => makeBolt(i + 1));
    queueLookups({ cards, commander: { oracle_id: "cmd", color_identity: ["R"] } });
    const result = await validateDeck(
      cards.map((c) => c.name),
      "cmd",
      3,
    );
    expect(
      result.violations.filter((v) => v.type === "wrong_count"),
    ).toEqual([]);
  });

  it("returns early with empty result for empty input", async () => {
    const result = await validateDeck([], "cmd", 3);
    expect(result.violations).toEqual([]);
    expect(result.isClean).toBe(true);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
