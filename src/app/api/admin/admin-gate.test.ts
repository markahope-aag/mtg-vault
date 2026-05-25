/**
 * Contract test for the /api/admin/* gate.
 *
 * api.test.ts mocks @/lib/auth/require-admin so per-route tests can
 * focus on route logic. That's the right call for those tests, but it
 * means the gate ISN'T asserted at the route layer there. This file
 * fills the gap — no mock on require-admin, real createClient stub,
 * exercises each admin entry point with three user shapes:
 *
 *   - no user        → expect 401
 *   - non-admin user → expect 403
 *   - admin user     → expect anything except 401/403 (route logic
 *                       may still 400/404/500 for other reasons)
 *
 * The allowlist/admin-list parsing is unit-tested separately in
 * allowlist.test.ts (parseAdminEmails / isAdminEmail). This test
 * pins the contract that the gate is actually wired up in each
 * admin route handler.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
  }),
}));

// Stub DB so route bodies that DO get past the gate don't blow up
// looking for tables.
import { createDbMock } from "@/test/helpers";
vi.mock("@/db/client", () => ({ db: createDbMock().db }));

// Some admin routes pull in heavier code paths once past the gate;
// stub the ones that don't matter for THIS test (we only care about
// the 401/403/200 trichotomy).
vi.mock("@/lib/spellbook", () => ({
  estimateBracket: vi.fn().mockResolvedValue({ bracket: 1, reasons: [] }),
  SpellbookUnavailableError: class extends Error {},
}));

const ADMIN_EMAIL = "op@example.com";
const NON_ADMIN_EMAIL = "partner@example.com";

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

describe("admin gate contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOWED_EMAIL = `${ADMIN_EMAIL},${NON_ADMIN_EMAIL}`;
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  });

  function setUser(email: string | null) {
    if (email === null) {
      getUser.mockResolvedValue({ data: { user: null } });
    } else {
      getUser.mockResolvedValue({ data: { user: { id: "u", email } } });
    }
  }

  describe("/api/admin/bracket-flag-audit GET", () => {
    async function load() {
      return (await import("@/app/api/admin/bracket-flag-audit/route")).GET;
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())()).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())()).status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())();
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/spellbook-test GET", () => {
    async function load() {
      return (await import("@/app/api/admin/spellbook-test/route")).GET;
    }
    function req() {
      return new NextRequest(
        "http://localhost/api/admin/spellbook-test?oracleIds=abc&commanderIds=xyz",
      );
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())(req())).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())(req())).status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())(req());
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/market-sources GET", () => {
    async function load() {
      return (await import("@/app/api/admin/market-sources/route")).GET;
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())()).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())()).status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())();
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/market-sources POST", () => {
    async function load() {
      return (await import("@/app/api/admin/market-sources/route")).POST;
    }
    function req() {
      return jsonReq("http://localhost/api/admin/market-sources", "POST", {});
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())(req())).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())(req())).status).toBe(403);
    });
    it("allows admin user past the gate (may 400 on invalid payload)", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())(req());
      // Body is empty, so the schema parse will 400. Either way it's
      // not 401/403, which proves the gate let us in.
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/market-sources PATCH", () => {
    async function load() {
      return (await import("@/app/api/admin/market-sources/route")).PATCH;
    }
    function req() {
      return jsonReq("http://localhost/api/admin/market-sources", "PATCH", {
        id: "11111111-1111-4111-8111-111111111111",
      });
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())(req())).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())(req())).status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())(req());
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/market-sources DELETE", () => {
    async function load() {
      return (await import("@/app/api/admin/market-sources/route")).DELETE;
    }
    function req() {
      return new NextRequest(
        "http://localhost/api/admin/market-sources?id=11111111-1111-4111-8111-111111111111",
        { method: "DELETE" },
      );
    }
    it("401 when no user", async () => {
      setUser(null);
      expect((await (await load())(req())).status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      expect((await (await load())(req())).status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())(req());
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("/api/admin/market-sources/[id]/test POST", () => {
    async function load() {
      return (
        await import("@/app/api/admin/market-sources/[id]/test/route")
      ).POST;
    }
    const params = Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" });
    function req() {
      return jsonReq(
        "http://localhost/api/admin/market-sources/x/test",
        "POST",
      );
    }
    it("401 when no user", async () => {
      setUser(null);
      const res = await (await load())(req(), { params });
      expect(res.status).toBe(401);
    });
    it("403 when non-admin user", async () => {
      setUser(NON_ADMIN_EMAIL);
      const res = await (await load())(req(), { params });
      expect(res.status).toBe(403);
    });
    it("allows admin user past the gate", async () => {
      setUser(ADMIN_EMAIL);
      const res = await (await load())(req(), { params });
      expect([401, 403]).not.toContain(res.status);
    });
  });
});
