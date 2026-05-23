import { describe, expect, it } from "vitest";
import {
  get,
  normalizeCondition,
  normalizeLanguage,
  parseDate,
  parsePrice,
} from "./types";

describe("normalizeCondition", () => {
  it("defaults to NM when missing", () => {
    expect(normalizeCondition(undefined)).toBe("NM");
  });

  it("maps common abbreviations", () => {
    expect(normalizeCondition("Near Mint")).toBe("NM");
    expect(normalizeCondition("LP")).toBe("LP");
    expect(normalizeCondition("moderately played")).toBe("MP");
    expect(normalizeCondition("HP")).toBe("HP");
    expect(normalizeCondition("Damaged")).toBe("DMG");
  });

  it("falls back to NM for unrecognized values", () => {
    expect(normalizeCondition("???")).toBe("NM");
  });
});

describe("normalizeLanguage", () => {
  it("defaults to en", () => {
    expect(normalizeLanguage(undefined)).toBe("en");
  });

  it("maps friendly names to ISO codes", () => {
    expect(normalizeLanguage("Japanese")).toBe("ja");
    expect(normalizeLanguage("DE")).toBe("de");
  });

  it("passes through two-letter codes", () => {
    expect(normalizeLanguage("fr")).toBe("fr");
  });
});

describe("parsePrice", () => {
  it("parses currency strings", () => {
    expect(parsePrice("$12.50")).toBe(12.5);
    expect(parsePrice("USD 3.00")).toBe(3);
  });

  it("returns undefined for empty input", () => {
    expect(parsePrice(undefined)).toBeUndefined();
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice("n/a")).toBeUndefined();
  });
});

describe("parseDate", () => {
  it("parses ISO dates", () => {
    const d = parseDate("2024-01-15");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2024);
  });

  it("returns undefined for invalid dates", () => {
    expect(parseDate("not-a-date")).toBeUndefined();
  });
});

describe("get", () => {
  it("finds values case-insensitively", () => {
    const row = { "Set Code": "neo", Name: "Lightning Bolt" };
    expect(get(row, "set code")).toBe("neo");
    expect(get(row, "NAME")).toBe("Lightning Bolt");
  });

  it("tries candidates in order", () => {
    const row = { "Edition Code": "cmr" };
    expect(get(row, "Set Code", "Edition Code")).toBe("cmr");
  });

  it("returns undefined when no candidate matches", () => {
    expect(get({ Name: "X" }, "Set code")).toBeUndefined();
  });
});
