import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createDbMock, cronRequest, jsonRequest } from "@/test/helpers";

const dbMock = createDbMock();

vi.mock("@/db/client", () => ({ db: dbMock.db }));

vi.mock("@/db/queries/collection-value", () => ({
  upsertTodaysCollectionSnapshot: vi.fn().mockResolvedValue({ date: "2024-01-01" }),
}));

vi.mock("@/lib/decks/queries", () => ({
  listDecks: vi.fn().mockResolvedValue([]),
  fetchDeckDetail: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/inventory/queries", () => ({
  listInventory: vi.fn().mockResolvedValue({
    rows: [],
    nextCursor: null,
    totalCount: 0,
    totalValueUsd: 0,
  }),
}));

vi.mock("@/lib/bracket-flags", () => ({
  refreshAllBracketFlags: vi.fn().mockResolvedValue({
    extraTurnCount: 0,
    mldCount: 0,
    tutorCount: 0,
    gameChangerCount: 0,
    durations: {},
    errors: [],
  }),
}));

vi.mock("@/lib/game-changers", () => ({
  syncGameChangers: vi.fn().mockResolvedValue({ count: 0 }),
}));

describe("API routes", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "route-test-secret";
    dbMock.mocks.execute.mockReset();
    dbMock.mocks.execute.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
  });

  describe("cron routes", () => {
    const cronRoutes = [
      ["daily-snapshot", () => import("@/app/api/cron/daily-snapshot/route")],
      ["game-changers-sync", () => import("@/app/api/cron/game-changers-sync/route")],
      ["refresh-bracket-flags", () => import("@/app/api/cron/refresh-bracket-flags/route")],
    ] as const;

    it.each(cronRoutes)("%s rejects missing auth", async (_name, loader) => {
      const { GET } = await loader();
      const res = await GET(cronRequest("/api/cron/x"));
      expect(res.status).toBe(401);
    });

    it.each(cronRoutes)("%s accepts valid cron auth", async (_name, loader) => {
      const { GET } = await loader();
      const res = await GET(cronRequest("/api/cron/x", "route-test-secret"));
      expect(res.status).toBe(200);
    });
  });

  describe("decks route", () => {
    it("GET returns deck list JSON", async () => {
      const { GET } = await import("@/app/api/decks/route");
      const res = await GET(new NextRequest("http://localhost/api/decks"));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("decks");
    });

    it("POST rejects invalid JSON body", async () => {
      const { POST } = await import("@/app/api/decks/route");
      const res = await POST(
        jsonRequest("http://localhost/api/decks", "POST", { name: "" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("inventory route", () => {
    it("GET returns inventory payload", async () => {
      const { GET } = await import("@/app/api/inventory/route");
      const res = await GET(new NextRequest("http://localhost/api/inventory"));
      expect(res.status).toBe(200);
    });

    it("POST rejects empty rows", async () => {
      const { POST } = await import("@/app/api/inventory/route");
      const res = await POST(
        jsonRequest("http://localhost/api/inventory", "POST", { rows: [] }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("collection snapshot route", () => {
    it("POST returns snapshot result", async () => {
      const { POST } = await import("@/app/api/collection/snapshot/route");
      const res = await POST();
      expect(res.status).toBe(200);
    });
  });

  describe("search route", () => {
    it("GET requires a query parameter", async () => {
      const { GET } = await import("@/app/api/search/route");
      const res = await GET(new NextRequest("http://localhost/api/search"));
      expect(res.status).toBe(400);
    });
  });

  describe("locations route", () => {
    it("GET lists locations", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/locations/route");
      const res = await GET();
      expect(res.status).toBe(200);
    });

    it("POST rejects empty name", async () => {
      const { POST } = await import("@/app/api/locations/route");
      const res = await POST(
        jsonRequest("http://localhost/api/locations", "POST", { name: "" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("import csv route", () => {
    it("POST preview rejects missing file payload", async () => {
      const { POST } = await import("@/app/api/import/csv/route");
      const res = await POST(
        new NextRequest("http://localhost/api/import/csv?mode=preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("deck detail route", () => {
    it("GET returns 404 for missing deck", async () => {
      const { GET } = await import("@/app/api/decks/[id]/route");
      const res = await GET(
        new NextRequest("http://localhost/api/decks/missing"),
        { params: Promise.resolve({ id: "missing" }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("inventory dispose route", () => {
    it("POST rejects invalid dispose payload", async () => {
      const { POST } = await import("@/app/api/inventory/[id]/dispose/route");
      const res = await POST(
        jsonRequest("http://localhost/api/inventory/x/dispose", "POST", {}),
        { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("admin routes", () => {
    it("spellbook-test GET returns JSON", async () => {
      const { GET } = await import("@/app/api/admin/spellbook-test/route");
      const res = await GET(new NextRequest("http://localhost/api/admin/spellbook-test"));
      expect([200, 500]).toContain(res.status);
    });
  });
});
