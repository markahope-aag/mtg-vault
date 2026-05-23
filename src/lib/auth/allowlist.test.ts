import { describe, expect, it } from "vitest";
import {
  isAllowedEmail,
  isAuthRoutePath,
  parseAllowedEmails,
  shouldBypassAuth,
} from "./allowlist";

describe("parseAllowedEmails", () => {
  it("splits comma-separated emails and normalizes case", () => {
    expect(parseAllowedEmails("  A@x.com , B@y.com ")).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });

  it("returns empty for undefined", () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
  });
});

describe("isAllowedEmail", () => {
  const list = ["me@example.com"];

  it("matches case-insensitively", () => {
    expect(isAllowedEmail("Me@Example.com", list)).toBe(true);
  });

  it("rejects null/undefined", () => {
    expect(isAllowedEmail(null, list)).toBe(false);
    expect(isAllowedEmail(undefined, list)).toBe(false);
  });
});

describe("route helpers", () => {
  it("identifies auth routes", () => {
    expect(isAuthRoutePath("/login")).toBe(true);
    expect(isAuthRoutePath("/auth/callback")).toBe(true);
    expect(isAuthRoutePath("/dashboard")).toBe(false);
  });

  it("bypasses cron paths", () => {
    expect(shouldBypassAuth("/api/cron/daily-snapshot")).toBe(true);
    expect(shouldBypassAuth("/api/decks")).toBe(false);
  });
});
