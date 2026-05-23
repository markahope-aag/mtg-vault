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

vi.mock("@/db/queries/availability", () => ({
  getAvailability: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/ai/scan-card", () => ({
  scanCard: vi.fn().mockResolvedValue({ name: null, setCode: null }),
}));

import { scanCard } from "@/lib/ai/scan-card";

const ROW_ID = "11111111-1111-4111-8111-111111111111";
const ORACLE_ID = "22222222-2222-4222-8222-222222222222";
const PRINTING_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const TRADE_ID = "66666666-6666-4666-8666-666666666666";
const INVENTORY_ID = "55555555-5555-4555-8555-555555555555";
const VALID_IMAGE_BASE64 = "A".repeat(64);

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
    it("GET returns search results payload", async () => {
      const { GET } = await import("@/app/api/search/route");
      const res = await GET(new NextRequest("http://localhost/api/search"));
      expect(res.status).toBe(200);
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

    it("bracket-flag-audit GET returns audit buckets", async () => {
      dbMock.mocks.execute.mockResolvedValue([]);
      const { GET } = await import("@/app/api/admin/bracket-flag-audit/route");
      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        extraTurnSuspicious: [],
        extraTurnFalsePositive: [],
        mldMissingFromCurated: [],
        tutorMissing: [],
      });
    });
  });

  describe("inventory helper routes", () => {
    const helperRoutes = [
      ["sources", () => import("@/app/api/inventory/sources/route"), "sources"],
      ["locations", () => import("@/app/api/inventory/locations/route"), "locations"],
      ["dispose-targets", () => import("@/app/api/inventory/dispose-targets/route"), "targets"],
    ] as const;

    it.each(helperRoutes)("%s GET returns list JSON", async (_name, loader, key) => {
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await loader();
      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty(key);
    });
  });

  describe("decks lookup route", () => {
    it("GET rejects missing printingId", async () => {
      const { GET } = await import("@/app/api/decks/_lookup/route");
      const res = await GET(new NextRequest("http://localhost/api/decks/_lookup"));
      expect(res.status).toBe(400);
    });

    it("GET returns 404 when printing is unknown", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/decks/_lookup/route");
      const res = await GET(
        new NextRequest("http://localhost/api/decks/_lookup?printingId=x"),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("inventory row routes", () => {
    it("PATCH rejects invalid payload", async () => {
      const { PATCH } = await import("@/app/api/inventory/[id]/route");
      const res = await PATCH(
        jsonRequest(`http://localhost/api/inventory/${ROW_ID}`, "PATCH", {
          condition: "INVALID",
        }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(400);
    });

    it("DELETE returns 404 when row is missing", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { DELETE } = await import("@/app/api/inventory/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/inventory/${ROW_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST restore returns 404 when row is missing", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { POST } = await import("@/app/api/inventory/[id]/restore/route");
      const res = await POST(
        new NextRequest(`http://localhost/api/inventory/${ROW_ID}/restore`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("decks availability route", () => {
    it("POST rejects invalid body", async () => {
      const { POST } = await import("@/app/api/decks/[id]/availability/route");
      const res = await POST(
        jsonRequest("http://localhost/api/decks/x/availability", "POST", {}),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(400);
    });

    it("POST returns availability map", async () => {
      const { POST } = await import("@/app/api/decks/[id]/availability/route");
      const res = await POST(
        jsonRequest("http://localhost/api/decks/x/availability", "POST", {
          oracleIds: [ORACLE_ID],
        }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("availability");
    });
  });

  describe("cards price-history route", () => {
    it("GET returns price points", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/cards/[oracle_id]/price-history/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/cards/${ORACLE_ID}/price-history`),
        { params: Promise.resolve({ oracle_id: ORACLE_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("points");
    });
  });

  describe("decks duplicate route", () => {
    it("POST returns 404 for missing deck", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { POST } = await import("@/app/api/decks/[id]/duplicate/route");
      const res = await POST(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}/duplicate`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("deck cards route", () => {
    const cardsUrl = `http://localhost/api/decks/${ROW_ID}/cards`;
    const routeParams = { params: Promise.resolve({ id: ROW_ID }) };

    it("POST rejects invalid JSON", async () => {
      const { POST } = await import("@/app/api/decks/[id]/cards/route");
      const res = await POST(
        new NextRequest(cardsUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
        routeParams,
      );
      expect(res.status).toBe(400);
    });

    it("POST rejects payload without delta or set", async () => {
      const { POST } = await import("@/app/api/decks/[id]/cards/route");
      const res = await POST(
        jsonRequest(cardsUrl, "POST", { printingId: PRINTING_ID }),
        routeParams,
      );
      expect(res.status).toBe(400);
    });

    it("POST returns 404 when deck is missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { POST } = await import("@/app/api/decks/[id]/cards/route");
      const res = await POST(
        jsonRequest(cardsUrl, "POST", {
          printingId: PRINTING_ID,
          set: 1,
        }),
        routeParams,
      );
      expect(res.status).toBe(404);
    });

    it("POST inserts a new deck card", async () => {
      dbMock.mocks.limit
        .mockResolvedValueOnce([{ id: ROW_ID }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      dbMock.mocks.returning.mockResolvedValueOnce([
        {
          deckId: ROW_ID,
          printingId: PRINTING_ID,
          quantity: 1,
          category: "main",
        },
      ]);
      const { POST } = await import("@/app/api/decks/[id]/cards/route");
      const res = await POST(
        jsonRequest(cardsUrl, "POST", {
          printingId: PRINTING_ID,
          set: 1,
        }),
        routeParams,
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({
        row: { printingId: PRINTING_ID, quantity: 1 },
      });
    });

    it("PATCH rejects invalid payload", async () => {
      const { PATCH } = await import("@/app/api/decks/[id]/cards/route");
      const res = await PATCH(
        jsonRequest(cardsUrl, "PATCH", {
          printingId: "not-a-uuid",
          fromCategory: "main",
          toCategory: "side effects",
        }),
        routeParams,
      );
      expect(res.status).toBe(400);
    });

    it("PATCH returns unchanged when categories match", async () => {
      const { PATCH } = await import("@/app/api/decks/[id]/cards/route");
      const res = await PATCH(
        jsonRequest(cardsUrl, "PATCH", {
          printingId: PRINTING_ID,
          fromCategory: "main",
          toCategory: "main",
        }),
        routeParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true, unchanged: true });
    });

    it("PATCH returns 404 when source row is missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { PATCH } = await import("@/app/api/decks/[id]/cards/route");
      const res = await PATCH(
        jsonRequest(cardsUrl, "PATCH", {
          printingId: PRINTING_ID,
          fromCategory: "main",
          toCategory: "sideboard",
        }),
        routeParams,
      );
      expect(res.status).toBe(404);
    });

    it("PATCH moves a card to a new category", async () => {
      dbMock.mocks.limit
        .mockResolvedValueOnce([{ quantity: 1 }])
        .mockResolvedValueOnce([]);
      const { PATCH } = await import("@/app/api/decks/[id]/cards/route");
      const res = await PATCH(
        jsonRequest(cardsUrl, "PATCH", {
          printingId: PRINTING_ID,
          fromCategory: "main",
          toCategory: "sideboard",
        }),
        routeParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });

  describe("deck card delete route", () => {
    const deleteUrl = `http://localhost/api/decks/${ROW_ID}/cards/${PRINTING_ID}`;
    const routeParams = {
      params: Promise.resolve({ id: ROW_ID, printingId: PRINTING_ID }),
    };

    it("DELETE returns 404 when card slot is missing", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { DELETE } = await import("@/app/api/decks/[id]/cards/[printingId]/route");
      const res = await DELETE(new NextRequest(deleteUrl, { method: "DELETE" }), routeParams);
      expect(res.status).toBe(404);
    });

    it("DELETE removes a deck card slot", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([{ printingId: PRINTING_ID }]);
      const { DELETE } = await import("@/app/api/decks/[id]/cards/[printingId]/route");
      const res = await DELETE(new NextRequest(deleteUrl, { method: "DELETE" }), routeParams);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });

  describe("import batch undo route", () => {
    const undoUrl = `http://localhost/api/import/batches/${BATCH_ID}/undo`;
    const routeParams = { params: Promise.resolve({ id: BATCH_ID }) };

    it("POST returns 404 when batch is missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { POST } = await import("@/app/api/import/batches/[id]/undo/route");
      const res = await POST(
        new NextRequest(undoUrl, { method: "POST" }),
        routeParams,
      );
      expect(res.status).toBe(404);
    });

    it("POST undoes a standard import batch", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        { id: BATCH_ID, mode: "append" },
      ]);
      dbMock.mocks.returning.mockResolvedValueOnce([
        { id: INVENTORY_ID },
        { id: "77777777-7777-4777-8777-777777777777" },
      ]);
      const { POST } = await import("@/app/api/import/batches/[id]/undo/route");
      const res = await POST(
        new NextRequest(undoUrl, { method: "POST" }),
        routeParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        ok: true,
        deleted: 2,
        restored: 0,
      });
    });

    it("POST restores disposed rows for replace_location batches", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        { id: BATCH_ID, mode: "replace_location" },
      ]);
      dbMock.mocks.returning
        .mockResolvedValueOnce([{ id: INVENTORY_ID }])
        .mockResolvedValueOnce([{ id: "88888888-8888-4888-8888-888888888888" }]);
      const { POST } = await import("@/app/api/import/batches/[id]/undo/route");
      const res = await POST(
        new NextRequest(undoUrl, { method: "POST" }),
        routeParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        ok: true,
        deleted: 1,
        restored: 1,
      });
    });
  });

  describe("trades routes", () => {
    it("POST rejects empty trade body", async () => {
      const { POST } = await import("@/app/api/trades/route");
      const res = await POST(
        jsonRequest("http://localhost/api/trades", "POST", {
          partner: "Alex",
          out: [],
          in: [],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST rejects invalid outgoing inventory id", async () => {
      const { POST } = await import("@/app/api/trades/route");
      const res = await POST(
        jsonRequest("http://localhost/api/trades", "POST", {
          partner: "Alex",
          out: [{ inventoryId: "not-a-uuid" }],
          in: [],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST creates a trade with incoming cards", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([
        {
          id: TRADE_ID,
          partner: "Alex",
          tradedAt: new Date("2024-06-01T12:00:00.000Z"),
          notes: null,
        },
      ]);
      const { POST } = await import("@/app/api/trades/route");
      const res = await POST(
        jsonRequest("http://localhost/api/trades", "POST", {
          partner: "Alex",
          out: [],
          in: [{ printingId: PRINTING_ID, condition: "NM" }],
        }),
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({
        trade: { id: TRADE_ID, partner: "Alex" },
      });
    });

    it("GET lists trades", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          id: TRADE_ID,
          partner: "Alex",
          traded_at: "2024-06-01T12:00:00.000Z",
          notes: null,
          created_at: "2024-06-01T12:00:00.000Z",
          out_count: 1,
          out_value: "10.00",
          in_count: 2,
          in_value: "25.50",
        },
      ]);
      const { GET } = await import("@/app/api/trades/route");
      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        trades: [
          {
            id: TRADE_ID,
            partner: "Alex",
            tradedAt: "2024-06-01T12:00:00.000Z",
            notes: null,
            outCount: 1,
            outValue: 10,
            inCount: 2,
            inValue: 25.5,
          },
        ],
      });
    });

    it("GET detail returns 404 for missing trade", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/trades/[id]/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/trades/${TRADE_ID}`),
        { params: Promise.resolve({ id: TRADE_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("GET detail returns trade ledger rows", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        {
          id: TRADE_ID,
          partner: "Alex",
          tradedAt: new Date("2024-06-01T12:00:00.000Z"),
          notes: "FNM trade",
        },
      ]);
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          id: INVENTORY_ID,
          foil: false,
          etched: false,
          condition: "NM",
          disposed_at: "2024-06-01T12:00:00.000Z",
          disposed_price: "5.00",
          disposed_to: "Trade: Alex",
          acquired_price: null,
          purchased_from: null,
          location: null,
          oracle_id: ORACLE_ID,
          name: "Sol Ring",
          mana_cost: "{1}",
          type_line: "Artifact",
          set_code: "c21",
          set_name: "Commander 2021",
          collector_number: "250",
          image_uri: null,
        },
        {
          id: "99999999-9999-4999-8999-999999999999",
          foil: false,
          etched: false,
          condition: "LP",
          disposed_at: null,
          disposed_price: null,
          disposed_to: null,
          acquired_price: "3.50",
          purchased_from: "Trade: Alex",
          location: "Binder A",
          oracle_id: ORACLE_ID,
          name: "Lightning Bolt",
          mana_cost: "{R}",
          type_line: "Instant",
          set_code: "mh2",
          set_name: "Modern Horizons 2",
          collector_number: "361",
          image_uri: null,
        },
      ]);
      const { GET } = await import("@/app/api/trades/[id]/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/trades/${TRADE_ID}`),
        { params: Promise.resolve({ id: TRADE_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.trade.partner).toBe("Alex");
      expect(body.out).toHaveLength(1);
      expect(body.in).toHaveLength(1);
      expect(body.out[0].name).toBe("Sol Ring");
      expect(body.in[0].name).toBe("Lightning Bolt");
    });
  });

  describe("scan-card route", () => {
    const scanUrl = "http://localhost/api/scan-card";

    it("POST rejects invalid JSON", async () => {
      const { POST } = await import("@/app/api/scan-card/route");
      const res = await POST(
        new NextRequest(scanUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST rejects short image payloads", async () => {
      const { POST } = await import("@/app/api/scan-card/route");
      const res = await POST(
        jsonRequest(scanUrl, "POST", {
          imageBase64: "abc",
          mediaType: "image/jpeg",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST rejects unsupported media types", async () => {
      const { POST } = await import("@/app/api/scan-card/route");
      const res = await POST(
        jsonRequest(scanUrl, "POST", {
          imageBase64: VALID_IMAGE_BASE64,
          mediaType: "image/gif",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST returns scan result without a DB match", async () => {
      vi.mocked(scanCard).mockResolvedValueOnce({
        name: null,
        setCode: null,
      });
      const { POST } = await import("@/app/api/scan-card/route");
      const res = await POST(
        jsonRequest(scanUrl, "POST", {
          imageBase64: VALID_IMAGE_BASE64,
          mediaType: "image/png",
        }),
      );
      expect(res.status).toBe(200);
      expect(scanCard).toHaveBeenCalledWith(VALID_IMAGE_BASE64, "image/png");
      await expect(res.json()).resolves.toEqual({
        scan: { name: null, setCode: null },
        match: null,
        candidates: [],
      });
    });
  });
});
