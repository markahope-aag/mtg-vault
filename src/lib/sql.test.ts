import { describe, expect, it } from "vitest";
import { sqlArray } from "./sql";

/** Collect string fragments from a Drizzle SQL chunk tree. */
function stringParts(chunks: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === "string") {
      out.push(chunk);
      continue;
    }
    if (chunk && typeof chunk === "object") {
      if ("value" in chunk && Array.isArray((chunk as { value: unknown[] }).value)) {
        for (const v of (chunk as { value: unknown[] }).value) {
          if (typeof v === "string") out.push(v);
        }
      }
      if ("queryChunks" in chunk) {
        out.push(
          ...stringParts((chunk as { queryChunks: unknown[] }).queryChunks),
        );
      }
    }
  }
  return out;
}

describe("sqlArray", () => {
  it("builds ARRAY[…]::uuid[] for uuid values", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const parts = stringParts(sqlArray([id], "uuid").queryChunks);
    expect(parts.join("")).toContain("ARRAY[");
    expect(parts.join("")).toContain("]::");
    expect(parts.join("")).toContain("uuid");
    expect(parts.join("")).toContain("[]");
    expect(JSON.stringify(sqlArray([id], "uuid").queryChunks)).toContain(id);
  });

  it("embeds each text value in the fragment", () => {
    const fragment = sqlArray(["W", "U"], "text");
    const serialized = JSON.stringify(fragment.queryChunks);
    expect(serialized).toContain('"W"');
    expect(serialized).toContain('"U"');
    expect(stringParts(fragment.queryChunks).join("")).toContain("text");
  });

  it("handles an empty array", () => {
    const parts = stringParts(sqlArray([], "uuid").queryChunks);
    const joined = parts.join("");
    expect(joined).toContain("ARRAY[");
    expect(joined).toContain("]::");
    expect(joined).toContain("uuid");
    expect(joined).toContain("[]");
    expect(JSON.stringify(sqlArray([], "uuid").queryChunks)).not.toMatch(
      /11111111/,
    );
  });
});
