import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
  }),
}));

import { requireSession } from "./require-session";

describe("requireSession", () => {
  const prev = process.env.ALLOWED_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOWED_EMAIL = "op@example.com,partner@example.com";
  });

  afterEach(() => {
    process.env.ALLOWED_EMAIL = prev;
  });

  it("returns ok=true + user for an allowlisted authenticated caller", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "op@example.com" } },
    });
    const result = await requireSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe("op@example.com");
    }
  });

  it("matches allowlist case-insensitively", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "OP@EXAMPLE.com" } },
    });
    const result = await requireSession();
    expect(result.ok).toBe(true);
  });

  it("returns ok=false + 401 when no user is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(401);
    }
  });

  it("returns ok=false + 403 when user is signed in but not allowlisted", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "stranger@example.com" } },
    });
    const result = await requireSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.res.status).toBe(403);
    }
  });
});
