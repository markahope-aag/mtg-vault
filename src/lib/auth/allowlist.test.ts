import { describe, expect, it } from "vitest";
import {
  isAdminEmail,
  isAllowedEmail,
  isAuthRoutePath,
  parseAdminEmails,
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

describe("parseAdminEmails / isAdminEmail", () => {
  const allow = ["op@example.com", "partner@example.com"];

  it("falls back to the allowlist when ADMIN_EMAIL is unset", () => {
    expect(parseAdminEmails(undefined, allow)).toEqual(allow);
    expect(parseAdminEmails("", allow)).toEqual(allow);
  });

  it("uses the explicit ADMIN_EMAIL list when set", () => {
    expect(parseAdminEmails("op@example.com", allow)).toEqual([
      "op@example.com",
    ]);
  });

  it("isAdminEmail matches case-insensitively", () => {
    const admins = parseAdminEmails("Op@Example.com", allow);
    expect(isAdminEmail("op@example.com", admins)).toBe(true);
    expect(isAdminEmail("OP@EXAMPLE.COM", admins)).toBe(true);
  });

  it("rejects non-admin allowlisted users when ADMIN_EMAIL is explicit", () => {
    const admins = parseAdminEmails("op@example.com", allow);
    expect(isAdminEmail("partner@example.com", admins)).toBe(false);
  });

  it("rejects null/undefined/missing email", () => {
    const admins = parseAdminEmails("op@example.com", allow);
    expect(isAdminEmail(null, admins)).toBe(false);
    expect(isAdminEmail(undefined, admins)).toBe(false);
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

  it("bypasses PWA manifest and service worker", () => {
    // The browser fetches /manifest.webmanifest without credentials, so
    // auth-gating it returns the /login HTML and breaks PWA install.
    expect(shouldBypassAuth("/manifest.webmanifest")).toBe(true);
    expect(shouldBypassAuth("/sw.js")).toBe(true);
  });
});
