import { describe, expect, it } from "vitest";
import {
  detectFoilInTitle,
  flagsFromTitle,
  normalizeCondition,
} from "./source";

describe("flagsFromTitle", () => {
  it("flags obvious lot listings", () => {
    expect(flagsFromTitle("4x Sol Ring lot")).toContain("possible_lot");
    expect(flagsFromTitle("Lightning Bolt bundle of 8")).toContain(
      "possible_lot",
    );
    expect(flagsFromTitle("MTG collection 1000 cards")).toContain(
      "possible_lot",
    );
    expect(flagsFromTitle("4 copies of Sol Ring")).toContain("possible_lot");
  });

  it("doesn't flag normal single-card listings as lots", () => {
    expect(flagsFromTitle("Sol Ring - C21 - NM")).not.toContain(
      "possible_lot",
    );
    expect(flagsFromTitle("Lightning Bolt - Modern Horizons 2")).not.toContain(
      "possible_lot",
    );
  });

  it("flags graded slabs", () => {
    expect(flagsFromTitle("Sol Ring PSA 10")).toContain("graded");
    expect(flagsFromTitle("Black Lotus BGS 8.5 slab")).toContain("graded");
    expect(flagsFromTitle("Counterspell CGC graded")).toContain("graded");
  });

  it("flags non-English listings", () => {
    expect(flagsFromTitle("Japanese Sol Ring foil")).toContain(
      "language_nonen",
    );
    expect(flagsFromTitle("Sol Ring [JP]")).toContain("language_nonen");
    expect(flagsFromTitle("German Black Lotus")).toContain("language_nonen");
  });

  it("flags proxies and playtest cards", () => {
    expect(flagsFromTitle("Black Lotus proxy")).toContain("playtest_proxy");
    expect(flagsFromTitle("Mox Sapphire playtest card")).toContain(
      "playtest_proxy",
    );
  });

  it("flags altered art", () => {
    expect(flagsFromTitle("Sol Ring altered art")).toContain("altered_artwork");
    expect(flagsFromTitle("Sol Ring extended art")).toContain(
      "altered_artwork",
    );
  });

  it("stacks multiple flags when warranted", () => {
    const flags = flagsFromTitle("4x Japanese Sol Ring graded PSA 9");
    expect(flags).toContain("possible_lot");
    expect(flags).toContain("language_nonen");
    expect(flags).toContain("graded");
  });
});

describe("normalizeCondition", () => {
  it("recognizes common condition words", () => {
    expect(normalizeCondition("Sol Ring Near Mint")).toBe("NM");
    expect(normalizeCondition("Lightning Bolt NM")).toBe("NM");
    expect(normalizeCondition("Counterspell lightly played")).toBe("LP");
    expect(normalizeCondition("Card LP")).toBe("LP");
    expect(normalizeCondition("Card moderately played")).toBe("MP");
    expect(normalizeCondition("Card heavily played")).toBe("HP");
    expect(normalizeCondition("Card poor")).toBe("DMG");
    expect(normalizeCondition("Card damaged")).toBe("DMG");
  });

  it("returns null when no condition signal present", () => {
    expect(normalizeCondition("Sol Ring - C21")).toBeNull();
    expect(normalizeCondition("")).toBeNull();
  });
});

describe("detectFoilInTitle", () => {
  it("detects positive foil signal", () => {
    expect(detectFoilInTitle("Sol Ring foil NM")).toBe(true);
    expect(detectFoilInTitle("Foil Lightning Bolt")).toBe(true);
  });

  it("detects explicit non-foil signal", () => {
    expect(detectFoilInTitle("Sol Ring non-foil")).toBe(false);
    expect(detectFoilInTitle("Sol Ring non foil")).toBe(false);
  });

  it("returns null when title is silent on foil", () => {
    expect(detectFoilInTitle("Sol Ring NM Commander 2021")).toBeNull();
  });
});

describe("flagsFromTitle — edge cases", () => {
  it("does not flag a normal single with a set code in the title", () => {
    expect(flagsFromTitle("Sol Ring - C21 - NM")).not.toContain("possible_lot");
  });
});
