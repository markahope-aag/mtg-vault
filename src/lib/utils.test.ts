import { describe, expect, it } from "vitest";
import { cn, toIso } from "./utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("toIso", () => {
  it("returns null for nullish input", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
  });

  it("formats Date instances", () => {
    const d = new Date("2024-06-01T12:00:00.000Z");
    expect(toIso(d)).toBe(d.toISOString());
  });

  it("parses postgres timestamp strings", () => {
    const iso = toIso("2026-05-21 00:48:20.755745");
    expect(iso).toMatch(/2026-05-21/);
  });

  it("returns null for invalid values", () => {
    expect(toIso("not-a-date")).toBeNull();
    expect(toIso(Number.NaN)).toBeNull();
  });
});
