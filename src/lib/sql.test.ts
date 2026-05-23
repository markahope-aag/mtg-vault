import { describe, expect, it } from "vitest";
import { sqlArray } from "./sql";

describe("sqlArray", () => {
  it("returns a SQL fragment with array constructor chunks", () => {
    const fragment = sqlArray(["11111111-1111-1111-1111-111111111111"], "uuid");
    expect(fragment.queryChunks.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(fragment.queryChunks);
    expect(serialized).toContain("ARRAY");
    expect(serialized).toContain("uuid[]");
  });

  it("binds each value as a separate parameter", () => {
    const fragment = sqlArray(["W", "U"], "text");
    const paramChunks = fragment.queryChunks.filter(
      (chunk) => typeof chunk !== "string",
    );
    expect(paramChunks).toHaveLength(2);
  });

  it("handles an empty array without parameters", () => {
    const fragment = sqlArray([], "uuid");
    const serialized = JSON.stringify(fragment.queryChunks);
    expect(serialized).toContain("ARRAY[]");
    expect(serialized).toContain("uuid[]");
    const paramChunks = fragment.queryChunks.filter(
      (chunk) => typeof chunk !== "string",
    );
    expect(paramChunks).toHaveLength(0);
  });
});
