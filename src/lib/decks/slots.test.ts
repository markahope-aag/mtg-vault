import { describe, expect, it } from "vitest";
import {
  classifyCard,
  slotStatus,
  targetsForBracket,
  type CardForClassification,
} from "./slots";

function card(overrides: Partial<CardForClassification> = {}): CardForClassification {
  return {
    name: "Test Card",
    typeLine: "Artifact",
    oracleText: "",
    manaCost: "{2}",
    ...overrides,
  };
}

describe("classifyCard", () => {
  it("classifies basic lands", () => {
    expect(
      classifyCard(
        card({ typeLine: "Basic Land — Forest", oracleText: "({T}: Add {G}.)" }),
      ),
    ).toBe("Land");
  });

  it("classifies mana rocks as Ramp", () => {
    expect(
      classifyCard(
        card({
          name: "Sol Ring",
          typeLine: "Artifact",
          oracleText: "{T}: Add {C}{C}.",
        }),
      ),
    ).toBe("Ramp");
  });

  it("classifies ramp spells as Ramp", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Sorcery",
          oracleText: "Search your library for a basic land card, put it onto the battlefield, then shuffle.",
        }),
      ),
    ).toBe("Ramp");
  });

  it("classifies tutors before generic draw", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Instant",
          oracleText:
            "Search your library for a creature card, reveal it, put it into your hand, then shuffle.",
        }),
      ),
    ).toBe("Tutor");
  });

  it("classifies spot removal", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Instant",
          oracleText: "Destroy target creature.",
        }),
      ),
    ).toBe("Removal");
  });

  it("classifies sweepers", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Sorcery",
          oracleText: "Destroy all creatures.",
        }),
      ),
    ).toBe("Sweeper");
  });

  it("classifies win-the-game effects", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Artifact",
          oracleText: "You win the game.",
        }),
      ),
    ).toBe("Wincon");
  });

  it("classifies large creatures as Wincon", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Creature — Dragon",
          oracleText: "Flying",
          power: "6",
          toughness: "6",
        }),
      ),
    ).toBe("Wincon");
  });

  it("classifies generic creatures as Synergy", () => {
    expect(
      classifyCard(
        card({
          typeLine: "Creature — Elf",
          oracleText: "Other Elves you control get +1/+1.",
          power: "2",
          toughness: "2",
        }),
      ),
    ).toBe("Synergy");
  });
});

describe("targetsForBracket", () => {
  it("defaults to bracket 2 targets when null", () => {
    const t = targetsForBracket(null);
    expect(t.Ramp.ideal).toBe(10);
    expect(t.Counterspell.ideal).toBe(0);
  });

  it("increases ramp and tutors at bracket 4", () => {
    const t = targetsForBracket(4);
    expect(t.Ramp.ideal).toBe(12);
    expect(t.Tutor.ideal).toBe(7);
    expect(t.Counterspell.min).toBe(3);
  });

  it("uses mid-tier targets at bracket 3", () => {
    const t = targetsForBracket(3);
    expect(t.Draw.ideal).toBe(10);
    expect(t.Tutor.max).toBe(4);
  });
});

describe("slotStatus", () => {
  it("reports under, ok, and over relative to min/max", () => {
    const target = { min: 8, max: 12 };
    expect(slotStatus(5, target)).toBe("under");
    expect(slotStatus(10, target)).toBe("ok");
    expect(slotStatus(15, target)).toBe("over");
  });
});
