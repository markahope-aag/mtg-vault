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

vi.mock("@/lib/bracket-engine", () => ({
  calculateBracket: vi.fn(),
}));

vi.mock("@/lib/ai/strategy", () => ({
  analyzeDeck: vi.fn(),
  deckSignatureFromDetail: vi.fn(() => "test-signature"),
  STRATEGY_MODEL: "claude-sonnet-4-6",
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
  scanCard: vi.fn().mockResolvedValue({
    name: null,
    setCode: null,
    collectorNumber: null,
    confidence: "low",
    notes: null,
  }),
}));

// Admin gate is unit-tested separately (lib/auth/allowlist.test.ts +
// proxy.test.ts). Stubbing here lets the per-route tests focus on the
// route's own behavior rather than re-asserting the gate.
vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
  requireAdminUser: vi.fn().mockResolvedValue({ email: "op@example.com" }),
}));

vi.mock("@/lib/market/bargain-sweep", () => ({
  sweepBargains: vi.fn().mockResolvedValue({
    bargains: [],
    unmetWants: [],
    sourceStats: [{ sourceId: "ebay", enabled: false, listingCount: 0, errorCount: 0 }],
  }),
}));

vi.mock("@/lib/market/wantlist", () => ({
  fetchWantList: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/rogue/reconcile", () => ({
  reconcile: vi.fn().mockResolvedValue({
    buckets: {
      available_now: [],
      movable: [],
      contested: [],
      must_buy: [],
    },
    summary: { totalCards: 0, ownedCount: 0, mustBuyCount: 0 },
    scenarios: {
      buy_everything: { totalCostUsd: 0, shoppingList: [], cardsPulledFromDecks: [], decksImpacted: [] },
      cannibalize_freely: { totalCostUsd: 0, shoppingList: [], cardsPulledFromDecks: [], decksImpacted: [] },
      protect_primary: { totalCostUsd: 0, shoppingList: [], cardsPulledFromDecks: [], decksImpacted: [] },
      price_threshold_split: { totalCostUsd: 0, shoppingList: [], cardsPulledFromDecks: [], decksImpacted: [] },
    },
    preExistingContention: [],
  }),
}));

vi.mock("@/lib/rogue/generate", () => ({
  generateDeck: vi.fn().mockResolvedValue({
    ok: true,
    commanderOracleId: "22222222-2222-4222-8222-222222222222",
    cardList: [{ oracleId: "22222222-2222-4222-8222-222222222222", name: "Sol Ring" }],
    analysis: { summary: "test" },
    log: { model: { generate: "claude-test" }, passes: [] },
  }),
}));

import { scanCard } from "@/lib/ai/scan-card";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { calculateBracket } from "@/lib/bracket-engine";
import { analyzeDeck } from "@/lib/ai/strategy";
import type { DeckDetail } from "@/lib/decks/types";
import type { BracketResult } from "@/lib/bracket-engine-types";

const ROW_ID = "11111111-1111-4111-8111-111111111111";
const ORACLE_ID = "22222222-2222-4222-8222-222222222222";
const PRINTING_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const INVENTORY_ID = "55555555-5555-4555-8555-555555555555";
const VALID_IMAGE_BASE64 = "A".repeat(64);
const LOCATION_ID = "77777777-7777-4777-8777-777777777777";
const SNAPSHOT_ID = "88888888-8888-4888-8888-888888888888";
const BRACKET_DECK_ID = "99999999-9999-4999-8999-999999999999";
const RATE_LIMIT_DECK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRANSACTION_ID = "66666666-6666-4666-8666-666666666666";
const PROPOSAL_ID = "77777777-7777-4777-8777-777777777777";
const MARKET_SOURCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mockBracketResult(overrides?: Partial<BracketResult>): BracketResult {
  return {
    bracket: 3,
    confidence: "calculated",
    reasons: [],
    metrics: {
      gameChangerCount: 0,
      twoCardComboCount: 0,
      multiCardComboCount: 0,
      massLandDenialCount: 0,
      extraTurnCount: 0,
      tutorCount: 0,
      deckSize: 100,
      commanderColorIdentity: ["G", "W", "U", "B"],
    },
    toReachBracket: {},
    spellbookAvailable: true,
    spellbookBracket: 3,
    spellbookBracketTag: null,
    ...overrides,
  };
}

function minimalDeckDetail(overrides?: {
  commander?: DeckDetail["commander"] | null;
  cards?: DeckDetail["cards"];
}): DeckDetail {
  const defaultCommander: DeckDetail["commander"] = {
    oracleId: ORACLE_ID,
    name: "Atraxa, Praetors' Voice",
    manaCost: "{2}{G}{W}{U}{B}",
    cmc: "5",
    typeLine: "Legendary Creature — Phyrexian Angel",
    oracleText: "Flying",
    colors: ["G", "W", "U", "B"],
    colorIdentity: ["G", "W", "U", "B"],
    keywords: [],
    printing: {
      id: PRINTING_ID,
      setCode: "c21",
      setName: "Commander 2021",
      collectorNumber: "1",
      imageUris: null,
      cardFaces: null,
      usd: "10.00",
      usdFoil: null,
    },
  };
  const commander: DeckDetail["commander"] =
    overrides && "commander" in overrides
      ? (overrides.commander ?? null)
      : defaultCommander;
  const cards = overrides?.cards ?? [
    {
      deckCardRow: { printingId: PRINTING_ID, quantity: 1, category: "main" },
      card: {
        oracleId: ORACLE_ID,
        name: "Sol Ring",
        manaCost: "{1}",
        cmc: "1",
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
        colors: [],
        colorIdentity: [],
        keywords: [],
        isCommanderLegal: true,
      },
      printing: {
        id: PRINTING_ID,
        setCode: "c21",
        setName: "Commander 2021",
        collectorNumber: "250",
        imageUris: null,
        cardFaces: null,
        usd: "1.00",
        usdFoil: null,
      },
      ownership: { ownedCount: 1, ownedAnyPrinting: 1, availableCount: 1 },
    },
  ];
  return {
    deck: {
      id: ROW_ID,
      name: "Test Deck",
      commanderPrintingId: PRINTING_ID,
      partnerPrintingId: null,
      targetBracket: 3,
      archetype: null,
      notes: null,
      isPrimary: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    commander,
    partner: null,
    cards,
    totalCards: cards.length + 1,
    totalValueUsd: 11,
    colorIdentity: commander?.colorIdentity ?? [],
  };
}

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
        new NextRequest("http://localhost/api/import/csv", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST commit creates a batch and inserts inventory rows", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([{ id: BATCH_ID }]);
      const { POST } = await import("@/app/api/import/csv/route");
      const res = await POST(
        jsonRequest("http://localhost/api/import/csv?commit=true", "POST", {
          fileHash: "deadbeef",
          filename: "manabox.csv",
          format: "manabox",
          defaultLocation: "Binder A",
          mode: "append",
          totalRows: 1,
          resolved: [
            {
              sourceRowIndex: 0,
              printingId: PRINTING_ID,
              quantity: 2,
            },
          ],
          unmatchedCount: 0,
          skippedCount: 0,
        }),
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        batchId: BATCH_ID,
        importedRows: 2,
        unmatchedRows: 0,
        skippedRows: 0,
      });
      expect(dbMock.mocks.transaction).toHaveBeenCalled();
    });
  });

  describe("deck detail route", () => {
    const deckParams = { params: Promise.resolve({ id: ROW_ID }) };

    it("GET returns 404 for missing deck", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(null);
      const { GET } = await import("@/app/api/decks/[id]/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}`),
        deckParams,
      );
      expect(res.status).toBe(404);
    });

    it("PATCH returns 404 when deck id is unknown", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { PATCH } = await import("@/app/api/decks/[id]/route");
      const res = await PATCH(
        jsonRequest(`http://localhost/api/decks/${ROW_ID}`, "PATCH", {
          name: "Renamed",
        }),
        deckParams,
      );
      expect(res.status).toBe(404);
    });

    it("DELETE returns 404 when deck id is unknown", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { DELETE } = await import("@/app/api/decks/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}`, {
          method: "DELETE",
        }),
        deckParams,
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

  describe("transactions routes", () => {
    const txnUrl = "http://localhost/api/transactions";
    const occurredAt = "2024-06-01T12:00:00.000Z";

    it("GET returns transaction list JSON", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          id: TRANSACTION_ID,
          kind: "purchase",
          occurred_at: occurredAt,
          counterparty: "LGS",
          channel: "lgs",
          cash_out_usd: "10.00",
          cash_in_usd: null,
          fees_usd: null,
          notes: null,
          created_at: occurredAt,
          in_count: 1,
          out_count: 0,
          in_value: "10.00",
          out_value: "0",
        },
      ]);
      const { GET } = await import("@/app/api/transactions/route");
      const res = await GET(new NextRequest(txnUrl));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0].kind).toBe("purchase");
    });

    it("POST rejects invalid JSON", async () => {
      const { POST } = await import("@/app/api/transactions/route");
      const res = await POST(
        new NextRequest(txnUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST rejects purchase without in lines", async () => {
      const { POST } = await import("@/app/api/transactions/route");
      const res = await POST(
        jsonRequest(txnUrl, "POST", {
          kind: "purchase",
          occurredAt,
          cashOutUsd: 10,
          lines: [{ direction: "out", printingId: PRINTING_ID, inventoryId: INVENTORY_ID }],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST records a purchase and returns 201", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([
        { id: PRINTING_ID, usd: "10.00", usd_foil: null },
      ]);
      dbMock.mocks.returning
        .mockResolvedValueOnce([{ id: TRANSACTION_ID }])
        .mockResolvedValueOnce([{ id: INVENTORY_ID }]);
      const { POST } = await import("@/app/api/transactions/route");
      const res = await POST(
        jsonRequest(txnUrl, "POST", {
          kind: "purchase",
          occurredAt,
          cashOutUsd: 10,
          lines: [{ direction: "in", printingId: PRINTING_ID }],
        }),
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toEqual({ id: TRANSACTION_ID });
    });

    it("GET detail returns 404 when missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/transactions/[id]/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/transactions/${TRANSACTION_ID}`),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("PATCH returns 404 when transaction id is unknown", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { PATCH } = await import("@/app/api/transactions/[id]/route");
      const res = await PATCH(
        jsonRequest(
          `http://localhost/api/transactions/${TRANSACTION_ID}`,
          "PATCH",
          { counterparty: "Updated" },
        ),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("DELETE returns 404 when transaction id is unknown", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([]);
      const { DELETE } = await import("@/app/api/transactions/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/transactions/${TRANSACTION_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST undo returns 404 when transaction is missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { POST } = await import("@/app/api/transactions/[id]/undo/route");
      const res = await POST(
        new NextRequest(
          `http://localhost/api/transactions/${TRANSACTION_ID}/undo`,
          { method: "POST" },
        ),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST undo returns 409 when in-lines were disposed downstream", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([{ id: TRANSACTION_ID }]);
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          line_id: "line-1",
          direction: "in",
          inventory_id: INVENTORY_ID,
          disposed_at: new Date("2024-07-01"),
          row_txn_id: TRANSACTION_ID,
          card_name: "Sol Ring",
        },
      ]);
      const { POST } = await import("@/app/api/transactions/[id]/undo/route");
      const res = await POST(
        new NextRequest(
          `http://localhost/api/transactions/${TRANSACTION_ID}/undo`,
          { method: "POST" },
        ),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.conflicts).toHaveLength(1);
    });

    it("POST undo deletes in-lines and removes the transaction", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([{ id: TRANSACTION_ID }]);
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          line_id: "line-1",
          direction: "in",
          inventory_id: INVENTORY_ID,
          disposed_at: null,
          row_txn_id: TRANSACTION_ID,
          card_name: "Sol Ring",
        },
      ]);
      dbMock.mocks.returning.mockResolvedValueOnce([{ id: INVENTORY_ID }]);
      const { POST } = await import("@/app/api/transactions/[id]/undo/route");
      const res = await POST(
        new NextRequest(
          `http://localhost/api/transactions/${TRANSACTION_ID}/undo`,
          { method: "POST" },
        ),
        { params: Promise.resolve({ id: TRANSACTION_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        ok: true,
        deleted: 1,
        restored: 0,
      });
    });
  });

  describe("proposals routes", () => {
    const proposalsUrl = "http://localhost/api/proposals";

    it("POST rejects invalid commanderOracleId", async () => {
      const { POST } = await import("@/app/api/proposals/route");
      const res = await POST(
        jsonRequest(proposalsUrl, "POST", {
          commanderOracleId: "not-a-uuid",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST creates a proposal after generation", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([{ id: PROPOSAL_ID }]);
      const { POST } = await import("@/app/api/proposals/route");
      const res = await POST(
        jsonRequest(proposalsUrl, "POST", {
          kind: "standard",
          commanderOracleId: ORACLE_ID,
          targetBracket: 3,
        }),
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({ id: PROPOSAL_ID, ok: true });
    });

    it("GET returns 404 for unknown proposal", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/proposals/[id]/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/proposals/${PROPOSAL_ID}`),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST reconcile returns 404 when proposal has no card list", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        { cardList: null },
      ]);
      const { POST } = await import("@/app/api/proposals/[id]/reconcile/route");
      const res = await POST(
        new NextRequest(
          `http://localhost/api/proposals/${PROPOSAL_ID}/reconcile`,
          { method: "POST" },
        ),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST reconcile returns reconcile payload", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        {
          cardList: [{ oracleId: ORACLE_ID, name: "Sol Ring" }],
        },
      ]);
      const { POST } = await import("@/app/api/proposals/[id]/reconcile/route");
      const res = await POST(
        new NextRequest(
          `http://localhost/api/proposals/${PROPOSAL_ID}/reconcile`,
          { method: "POST" },
        ),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("buckets");
    });

    it("POST save rejects missing deck name", async () => {
      const { POST } = await import("@/app/api/proposals/[id]/save/route");
      const res = await POST(
        jsonRequest(
          `http://localhost/api/proposals/${PROPOSAL_ID}/save`,
          "POST",
          {},
        ),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(400);
    });

    it("PATCH updates proposal fields", async () => {
      const { PATCH } = await import("@/app/api/proposals/[id]/route");
      const res = await PATCH(
        jsonRequest(`http://localhost/api/proposals/${PROPOSAL_ID}`, "PATCH", {
          archetypeBrief: "more tokens",
        }),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("DELETE removes a proposal", async () => {
      const { DELETE } = await import("@/app/api/proposals/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/proposals/${PROPOSAL_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });

  describe("market routes", () => {
    it("POST bargains runs sweep and returns JSON", async () => {
      const { POST } = await import("@/app/api/market/bargains/route");
      const res = await POST();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("bargains");
    });

    it("GET wants returns list JSON", async () => {
      const { GET } = await import("@/app/api/market/wants/route");
      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ wants: [] });
    });

    it("POST wants rejects invalid payload", async () => {
      const { POST } = await import("@/app/api/market/wants/route");
      const res = await POST(
        jsonRequest("http://localhost/api/market/wants", "POST", {}),
      );
      expect(res.status).toBe(400);
    });

    it("DELETE wants rejects missing id", async () => {
      const { DELETE } = await import("@/app/api/market/wants/route");
      const res = await DELETE(
        new NextRequest("http://localhost/api/market/wants", { method: "DELETE" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("deck reconcile route", () => {
    it("GET returns 404 when deck is missing", async () => {
      dbMock.mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/decks/[id]/reconcile/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}/reconcile`),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("GET returns reconcile JSON for an existing deck", async () => {
      dbMock.mocks.execute
        .mockResolvedValueOnce([{ oracle_id: ORACLE_ID, quantity: 1 }])
        .mockResolvedValueOnce([
          { commander_oracle_id: ORACLE_ID, partner_oracle_id: null },
        ]);
      const { GET } = await import("@/app/api/decks/[id]/reconcile/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}/reconcile`),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toHaveProperty("buckets");
    });
  });

  describe("admin market-sources route", () => {
    it("GET returns sources list", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          id: ROW_ID,
          source_key: "test-lgs",
          display_name: "Test LGS",
          base_url: "https://example-lgs.com",
          enabled: false,
        },
      ]);
      const { GET } = await import("@/app/api/admin/market-sources/route");
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sources).toHaveLength(1);
    });

    it("POST rejects hostile marketplace URLs", async () => {
      const { POST } = await import("@/app/api/admin/market-sources/route");
      const res = await POST(
        jsonRequest("http://localhost/api/admin/market-sources", "POST", {
          sourceKey: "tcg",
          displayName: "TCG",
          baseUrl: "https://tcgplayer.com",
          parserTemplate: "shopify",
          enabled: false,
          robotsAcknowledged: true,
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST creates a source when payload is valid", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([{ id: MARKET_SOURCE_ID }]);
      const { POST } = await import("@/app/api/admin/market-sources/route");
      const res = await POST(
        jsonRequest("http://localhost/api/admin/market-sources", "POST", {
          sourceKey: "friendly-lgs",
          displayName: "Friendly LGS",
          baseUrl: "https://example-lgs.com",
          parserTemplate: "shopify",
          enabled: false,
          robotsAcknowledged: true,
        }),
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toEqual({ id: MARKET_SOURCE_ID });
    });

    it("PATCH updates an existing source", async () => {
      const { PATCH } = await import("@/app/api/admin/market-sources/route");
      const res = await PATCH(
        jsonRequest("http://localhost/api/admin/market-sources", "PATCH", {
          id: MARKET_SOURCE_ID,
          enabled: true,
          robotsAcknowledged: true,
        }),
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("DELETE removes a source by id query param", async () => {
      const { DELETE } = await import("@/app/api/admin/market-sources/route");
      const res = await DELETE(
        new NextRequest(
          `http://localhost/api/admin/market-sources?id=${MARKET_SOURCE_ID}`,
          { method: "DELETE" },
        ),
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });

  describe("card detail route", () => {
    it("GET returns 404 when card is missing", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/cards/[oracle_id]/detail/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/cards/${ORACLE_ID}/detail`),
        { params: Promise.resolve({ oracle_id: ORACLE_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("GET returns card, printings, and ownership", async () => {
      dbMock.mocks.execute
        .mockResolvedValueOnce([
          {
            oracle_id: ORACLE_ID,
            name: "Sol Ring",
            mana_cost: "{1}",
            cmc: "1",
            type_line: "Artifact",
            oracle_text: "{T}: Add {C}{C}.",
            power: null,
            toughness: null,
            loyalty: null,
            color_identity: [],
            edhrec_rank: 1,
            is_game_changer: false,
            is_mass_land_denial: false,
            is_extra_turn: false,
            is_tutor: false,
            is_reserved_list: false,
            is_commander_legal: true,
            legalities: { commander: "legal" },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: PRINTING_ID,
            set_code: "c21",
            set_name: "Commander 2021",
            collector_number: "250",
            image_uri: null,
            usd: "1.00",
            usd_foil: null,
            rarity: "uncommon",
          },
        ])
        .mockResolvedValueOnce([
          {
            printing_id: PRINTING_ID,
            set_code: "c21",
            set_name: "Commander 2021",
            count: 2,
            locations: ["Binder A"],
          },
        ]);
      const { GET } = await import("@/app/api/cards/[oracle_id]/detail/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/cards/${ORACLE_ID}/detail`),
        { params: Promise.resolve({ oracle_id: ORACLE_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.card.name).toBe("Sol Ring");
      expect(body.printings).toHaveLength(1);
      expect(body.ownership.total).toBe(2);
    });
  });

  describe("deck bracket route", () => {
    const bracketUrl = (id: string, writeSnapshot = "false") =>
      `http://localhost/api/decks/${id}/bracket?writeSnapshot=${writeSnapshot}`;

    it("POST returns 404 when deck is missing", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(null);
      const { POST } = await import("@/app/api/decks/[id]/bracket/route");
      const res = await POST(
        new NextRequest(bracketUrl(ROW_ID)),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST returns bracket result without writing snapshot", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(minimalDeckDetail());
      vi.mocked(calculateBracket).mockResolvedValueOnce(mockBracketResult());
      const { POST } = await import("@/app/api/decks/[id]/bracket/route");
      const res = await POST(
        new NextRequest(bracketUrl(BRACKET_DECK_ID)),
        { params: Promise.resolve({ id: BRACKET_DECK_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ bracket: 3 });
    });

    it("POST rate limits rapid recalculation", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValue(minimalDeckDetail());
      vi.mocked(calculateBracket).mockResolvedValue(mockBracketResult());
      const { POST } = await import("@/app/api/decks/[id]/bracket/route");
      const params = { params: Promise.resolve({ id: RATE_LIMIT_DECK_ID }) };
      const req = new NextRequest(bracketUrl(RATE_LIMIT_DECK_ID));
      const first = await POST(req, params);
      expect(first.status).toBe(200);
      const second = await POST(req, params);
      expect(second.status).toBe(429);
    });
  });

  describe("deck analyze route", () => {
    const analyzeUrl = `http://localhost/api/decks/${ROW_ID}/analyze`;

    it("GET returns 404 when deck is missing", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(null);
      const { GET } = await import("@/app/api/decks/[id]/analyze/route");
      const res = await GET(
        new NextRequest(analyzeUrl),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("GET returns cached analysis metadata", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(minimalDeckDetail());
      dbMock.mocks.limit.mockResolvedValueOnce([
        {
          analysis: { archetype: "Counters" },
          analysisModel: "claude-sonnet-4-6",
          analysisSignature: "test-signature",
          analyzedAt: new Date("2024-06-01T12:00:00.000Z"),
        },
      ]);
      const { GET } = await import("@/app/api/decks/[id]/analyze/route");
      const res = await GET(
        new NextRequest(analyzeUrl),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.analysis).toMatchObject({ archetype: "Counters" });
      expect(body.isStale).toBe(false);
    });

    it("POST returns 503 when API key is missing", async () => {
      const prev = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const { POST } = await import("@/app/api/decks/[id]/analyze/route");
      const res = await POST(
        new NextRequest(analyzeUrl, { method: "POST" }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      process.env.ANTHROPIC_API_KEY = prev;
      expect(res.status).toBe(503);
    });

    it("POST returns 422 when deck has no commander", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(
        minimalDeckDetail({ commander: null }),
      );
      const { POST } = await import("@/app/api/decks/[id]/analyze/route");
      const res = await POST(
        new NextRequest(analyzeUrl, { method: "POST" }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(422);
    });

    it("POST stores analysis when commander is set", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(minimalDeckDetail());
      vi.mocked(analyzeDeck).mockResolvedValueOnce({
        archetype: "Counters",
        subArchetype: null,
        summary: "Grow counters.",
        winConditions: [],
        gameplan: { earlyGame: "", midGame: "", lateGame: "" },
        weaknesses: [],
        improvements: [],
        acquisitions: [],
      });
      const { POST } = await import("@/app/api/decks/[id]/analyze/route");
      const res = await POST(
        new NextRequest(analyzeUrl, { method: "POST" }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.analysis.archetype).toBe("Counters");
      expect(body.isStale).toBe(false);
    });
  });

  describe("deck coach route", () => {
    it("GET returns 404 when deck is missing", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(null);
      const { GET } = await import("@/app/api/decks/[id]/coach/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}/coach`),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("GET returns slot breakdown and suggestions", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(minimalDeckDetail());
      dbMock.mocks.execute.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/decks/[id]/coach/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/decks/${ROW_ID}/coach`),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.slots.length).toBeGreaterThan(0);
      expect(body.suggestions).toBeDefined();
    });
  });

  describe("deck snapshot routes", () => {
    const snapshotUrl = `http://localhost/api/decks/${ROW_ID}/snapshot`;
    const snapshotsUrl = `http://localhost/api/decks/${ROW_ID}/snapshots`;

    it("POST returns 404 when deck is missing", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(null);
      const { POST } = await import("@/app/api/decks/[id]/snapshot/route");
      const res = await POST(
        new NextRequest(snapshotUrl, { method: "POST" }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("POST creates a value snapshot", async () => {
      vi.mocked(fetchDeckDetail).mockResolvedValueOnce(minimalDeckDetail());
      dbMock.mocks.returning.mockResolvedValueOnce([
        {
          id: SNAPSHOT_ID,
          deckId: ROW_ID,
          snapshotAt: new Date("2024-06-01T12:00:00.000Z"),
          totalValueUsd: "11.00",
          calculatedBracket: null,
          bracketReasons: null,
        },
      ]);
      const { POST } = await import("@/app/api/decks/[id]/snapshot/route");
      const res = await POST(
        new NextRequest(snapshotUrl, { method: "POST" }),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        snapshot: { id: SNAPSHOT_ID },
      });
    });

    it("GET lists deck snapshots", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([
        {
          id: SNAPSHOT_ID,
          snapshotAt: new Date("2024-06-01T12:00:00.000Z"),
          totalValueUsd: "11.00",
          calculatedBracket: 3,
          bracketReasons: { reasons: [] },
        },
      ]);
      const { GET } = await import("@/app/api/decks/[id]/snapshots/route");
      const res = await GET(
        new NextRequest(snapshotsUrl),
        { params: Promise.resolve({ id: ROW_ID }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.snapshots).toHaveLength(1);
      expect(body.snapshots[0].calculatedBracket).toBe(3);
    });
  });

  describe("deck from-selection route", () => {
    it("POST rejects empty card list", async () => {
      const { POST } = await import("@/app/api/decks/from-selection/route");
      const res = await POST(
        jsonRequest("http://localhost/api/decks/from-selection", "POST", {
          name: "New Deck",
          cards: [],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("POST creates deck from selected printings", async () => {
      dbMock.mocks.returning.mockResolvedValueOnce([
        { id: ROW_ID, name: "Selection Deck" },
      ]);
      const { POST } = await import("@/app/api/decks/from-selection/route");
      const res = await POST(
        jsonRequest("http://localhost/api/decks/from-selection", "POST", {
          name: "Selection Deck",
          cards: [{ printingId: PRINTING_ID, quantity: 2 }],
        }),
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({
        deck: { name: "Selection Deck" },
        added: 1,
      });
    });
  });

  describe("inventory export route", () => {
    it("GET returns CSV attachment", async () => {
      dbMock.mocks.execute.mockResolvedValueOnce([
        {
          name: "Sol Ring",
          set_code: "c21",
          collector_number: "250",
          condition: "NM",
          language: "en",
          foil: false,
          etched: false,
          acquired_price: "1.00",
          acquired_at: "2024-01-01",
          purchased_from: null,
          location: null,
          physical_id: null,
          grading_company: null,
          grade: null,
          notes: null,
        },
      ]);
      const { GET } = await import("@/app/api/inventory/export/route");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      const text = await res.text();
      expect(text).toContain("Sol Ring");
      expect(text).toContain("Name");
      expect(text).toContain("Count");
    });
  });

  describe("location delete route", () => {
    it("DELETE returns 404 when location is missing", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([]);
      const { DELETE } = await import("@/app/api/locations/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/locations/${LOCATION_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: LOCATION_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("DELETE clears inventory and removes location", async () => {
      dbMock.mocks.limit.mockResolvedValueOnce([{ name: "Binder A" }]);
      dbMock.mocks.returning.mockResolvedValueOnce([
        { id: INVENTORY_ID },
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      ]);
      const { DELETE } = await import("@/app/api/locations/[id]/route");
      const res = await DELETE(
        new NextRequest(`http://localhost/api/locations/${LOCATION_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: LOCATION_ID }) },
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true, cleared: 2 });
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
        collectorNumber: null,
        confidence: "low",
        notes: null,
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
        scan: {
          name: null,
          setCode: null,
          collectorNumber: null,
          confidence: "low",
          notes: null,
        },
        match: null,
        candidates: [],
      });
    });
  });
});
