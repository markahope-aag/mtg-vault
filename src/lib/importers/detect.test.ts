import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect";

describe("detectFormat", () => {
  it("detects ManaBox by Scryfall ID + Foil headers", () => {
    expect(
      detectFormat(["Name", "Set code", "Collector number", "Scryfall ID", "Foil"]),
    ).toBe("manabox");
  });

  it("detects Moxfield by Tradelist Count + Edition", () => {
    expect(
      detectFormat(["Name", "Edition", "Collector Number", "Tradelist Count"]),
    ).toBe("moxfield");
  });

  it("detects Moxfield with Edition Name instead of Edition", () => {
    expect(
      detectFormat(["Name", "Edition Name", "Collector Number", "Tradelist Count"]),
    ).toBe("moxfield");
  });

  it("detects Archidekt by CollectorNumber + Edition Code", () => {
    expect(
      detectFormat(["Name", "Edition Code", "CollectorNumber", "Quantity"]),
    ).toBe("archidekt");
  });

  it("detects Archidekt with spaced Collector Number header", () => {
    expect(
      detectFormat(["Name", "Set Code", "Collector Number", "Quantity"]),
    ).toBe("archidekt");
  });

  it("detects TCGPlayer by Product Name + Number", () => {
    expect(
      detectFormat(["Product Name", "Set Name", "Number", "Quantity"]),
    ).toBe("tcgplayer");
  });

  it("returns unknown for unrecognized headers", () => {
    expect(detectFormat(["Card", "Qty"])).toBe("unknown");
  });

  it("is case-insensitive on headers", () => {
    expect(
      detectFormat(["name", "SET CODE", "collector number", "scryfall id", "foil"]),
    ).toBe("manabox");
  });
});
