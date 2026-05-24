import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

const BASE = "https://mtgvault.app";

describe("safeNextPath", () => {
  it("returns the default for null/undefined/empty", () => {
    expect(safeNextPath(null, BASE)).toBe("/dashboard");
    expect(safeNextPath(undefined, BASE)).toBe("/dashboard");
    expect(safeNextPath("", BASE)).toBe("/dashboard");
  });

  it("honors the override default", () => {
    expect(safeNextPath(null, BASE, "/inventory")).toBe("/inventory");
  });

  it("accepts a plain same-origin path", () => {
    expect(safeNextPath("/inventory", BASE)).toBe("/inventory");
    expect(safeNextPath("/decks/abc", BASE)).toBe("/decks/abc");
  });

  it("preserves query string and hash on accepted paths", () => {
    expect(safeNextPath("/decks?tab=builder", BASE)).toBe(
      "/decks?tab=builder",
    );
    expect(safeNextPath("/cards/abc#printings", BASE)).toBe(
      "/cards/abc#printings",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNextPath("//evil.com", BASE)).toBe("/dashboard");
    expect(safeNextPath("//evil.com/path", BASE)).toBe("/dashboard");
  });

  it("rejects the backslash-after-slash trick (/\\evil.com)", () => {
    // Some browsers normalize backslash to forward slash AFTER the
    // server-side redirect, so /\evil.com becomes //evil.com client-
    // side and exits the origin.
    expect(safeNextPath("/\\evil.com", BASE)).toBe("/dashboard");
    expect(safeNextPath("/\\\\evil.com", BASE)).toBe("/dashboard");
  });

  it("rejects bare hostnames (no leading slash)", () => {
    // `${publicOrigin}${next}` with next="evil.com" would produce
    // https://mtgvault.appevil.com — a registrable hostile subdomain.
    expect(safeNextPath("evil.com", BASE)).toBe("/dashboard");
    expect(safeNextPath("evil.com/x", BASE)).toBe("/dashboard");
  });

  it("rejects absolute URLs with explicit schemes", () => {
    expect(safeNextPath("https://evil.com/x", BASE)).toBe("/dashboard");
    expect(safeNextPath("http://evil.com/x", BASE)).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)", BASE)).toBe("/dashboard");
    expect(safeNextPath("data:text/html,foo", BASE)).toBe("/dashboard");
  });

  it("rejects relative paths that try to walk past origin", () => {
    // Anything not starting with a single `/` is bounced.
    expect(safeNextPath("../../etc/passwd", BASE)).toBe("/dashboard");
    expect(safeNextPath("./foo", BASE)).toBe("/dashboard");
  });

  it("rejects values that parse to a different origin even when they look pathy", () => {
    // Edge case: a path that the URL parser ends up resolving outside
    // the base origin (caught by the same-origin check).
    expect(safeNextPath("/\t//evil.com", BASE)).toBe("/dashboard");
  });
});
