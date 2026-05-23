import { describe, expect, it, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockInsertOnConflict = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/bracket-flags", () => ({
  updateExtraTurnFlags: vi.fn().mockResolvedValue(1),
  updateMldFlags: vi.fn().mockResolvedValue(2),
  updateTutorFlags: vi.fn().mockResolvedValue(3),
}));

import {
  syncScryfall,
  syncTutors,
  transformScryfallRow,
  type ScryfallBulkRow,
} from "./scryfall";
import { updateTutorFlags } from "@/lib/bracket-flags";

// ─── Test fixtures ─────────────────────────────────────────────

// Minimal-but-valid Scryfall row; specific tests override the fields they
// care about so assertions stay readable instead of restating the whole
// shape every time.
function scryfallRow(overrides: Partial<ScryfallBulkRow> = {}): ScryfallBulkRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    oracle_id: "22222222-2222-4222-8222-222222222222",
    name: "Lightning Bolt",
    lang: "en",
    set: "lea",
    set_name: "Limited Edition Alpha",
    collector_number: "162",
    type_line: "Instant",
    ...overrides,
  };
}

describe("syncTutors", () => {
  it("delegates to updateTutorFlags", async () => {
    await expect(syncTutors()).resolves.toEqual({ count: 3 });
    expect(updateTutorFlags).toHaveBeenCalled();
  });
});

describe("transformScryfallRow", () => {
  const today = "2026-05-23";

  it("skips non-English printings", () => {
    const result = transformScryfallRow(scryfallRow({ lang: "ja" }), today);
    expect(result).toEqual({ skip: "non-english" });
  });

  it("skips rows missing oracle_id (tokens, planar cards, etc.)", () => {
    const result = transformScryfallRow(
      scryfallRow({ oracle_id: undefined }),
      today,
    );
    expect(result).toEqual({ skip: "no-oracle-id" });
  });

  it("maps the core card fields with snake → camel renames", () => {
    const result = transformScryfallRow(
      scryfallRow({
        name: "Sol Ring",
        mana_cost: "{1}",
        cmc: 1,
        type_line: "Artifact",
        oracle_text: "Add {C}{C}.",
        color_identity: [],
        keywords: [],
        edhrec_rank: 1,
      }),
      today,
    );
    expect(result.skip).toBeNull();
    if (result.skip != null) return;
    expect(result.card).toMatchObject({
      name: "Sol Ring",
      manaCost: "{1}",
      cmc: "1",
      typeLine: "Artifact",
      oracleText: "Add {C}{C}.",
      colorIdentity: [],
      keywords: [],
      edhrecRank: 1,
    });
  });

  it("coerces a numeric cmc to string for the decimal column", () => {
    const result = transformScryfallRow(scryfallRow({ cmc: 4.5 }), today);
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.card.cmc).toBe("4.5");
  });

  it("defaults type_line to empty string when missing", () => {
    const result = transformScryfallRow(
      scryfallRow({ type_line: undefined }),
      today,
    );
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.card.typeLine).toBe("");
  });

  it("derives isCommanderLegal from legalities.commander", () => {
    const legal = transformScryfallRow(
      scryfallRow({ legalities: { commander: "legal" } }),
      today,
    );
    const banned = transformScryfallRow(
      scryfallRow({ legalities: { commander: "banned" } }),
      today,
    );
    const missing = transformScryfallRow(scryfallRow(), today);
    if (legal.skip != null || banned.skip != null || missing.skip != null)
      throw new Error("unexpected skip");
    expect(legal.card.isCommanderLegal).toBe(true);
    expect(banned.card.isCommanderLegal).toBe(false);
    // Missing legalities = not legal until proven otherwise.
    expect(missing.card.isCommanderLegal).toBe(false);
  });

  it("persists the full legalities object verbatim", () => {
    const legalities = {
      commander: "legal",
      modern: "not_legal",
      vintage: "restricted",
    };
    const result = transformScryfallRow(scryfallRow({ legalities }), today);
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.card.legalities).toBe(legalities);
  });

  it("coerces reserved flag through Boolean()", () => {
    const reserved = transformScryfallRow(
      scryfallRow({ reserved: true }),
      today,
    );
    const notReserved = transformScryfallRow(scryfallRow(), today);
    if (reserved.skip != null || notReserved.skip != null)
      throw new Error("unexpected skip");
    expect(reserved.card.isReservedList).toBe(true);
    expect(notReserved.card.isReservedList).toBe(false);
  });

  it("does NOT set the bracket-flag booleans (those are post-sync passes)", () => {
    const result = transformScryfallRow(scryfallRow(), today);
    if (result.skip != null) throw new Error("unexpected skip");
    // bracket-flags.ts owns isExtraTurn / isMassLandDenial / isTutor /
    // isGameChanger — the transform must not preempt them.
    expect(result.card.isExtraTurn).toBeUndefined();
    expect(result.card.isMassLandDenial).toBeUndefined();
    expect(result.card.isTutor).toBeUndefined();
    expect(result.card.isGameChanger).toBeUndefined();
  });

  it("parses released_at into a Date and leaves null otherwise", () => {
    const dated = transformScryfallRow(
      scryfallRow({ released_at: "1993-08-05" }),
      today,
    );
    const undated = transformScryfallRow(scryfallRow(), today);
    if (dated.skip != null || undated.skip != null)
      throw new Error("unexpected skip");
    expect(dated.printing.releasedAt).toBeInstanceOf(Date);
    expect((dated.printing.releasedAt as Date).getUTCFullYear()).toBe(1993);
    expect(undated.printing.releasedAt).toBeNull();
  });

  it("pulls every price field across to the printing row", () => {
    const result = transformScryfallRow(
      scryfallRow({
        prices: {
          usd: "1.00",
          usd_foil: "5.50",
          usd_etched: "8.25",
          eur: "0.90",
          tix: "0.03",
        },
      }),
      today,
    );
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.printing).toMatchObject({
      usd: "1.00",
      usdFoil: "5.50",
      usdEtched: "8.25",
      eur: "0.90",
      tix: "0.03",
    });
  });

  it("emits a price_history row when usd or usd_foil is present", () => {
    const result = transformScryfallRow(
      scryfallRow({
        prices: { usd: "1.00", usd_foil: "5.50" },
      }),
      today,
    );
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.price).toEqual({
      printingId: "11111111-1111-4111-8111-111111111111",
      date: today,
      usd: "1.00",
      usdFoil: "5.50",
    });
  });

  it("emits a price_history row when only one of usd / usd_foil is present", () => {
    const onlyUsd = transformScryfallRow(
      scryfallRow({ prices: { usd: "1.00" } }),
      today,
    );
    const onlyFoil = transformScryfallRow(
      scryfallRow({ prices: { usd_foil: "5.50" } }),
      today,
    );
    if (onlyUsd.skip != null || onlyFoil.skip != null)
      throw new Error("unexpected skip");
    expect(onlyUsd.price?.usd).toBe("1.00");
    expect(onlyUsd.price?.usdFoil).toBeNull();
    expect(onlyFoil.price?.usd).toBeNull();
    expect(onlyFoil.price?.usdFoil).toBe("5.50");
  });

  it("skips price_history when prices object is missing or has neither usd nor usd_foil", () => {
    const noPrices = transformScryfallRow(scryfallRow(), today);
    const eurOnly = transformScryfallRow(
      scryfallRow({ prices: { eur: "1.00" } }),
      today,
    );
    if (noPrices.skip != null || eurOnly.skip != null)
      throw new Error("unexpected skip");
    expect(noPrices.price).toBeNull();
    // Tracking history only when there's a USD signal — eur-only cards
    // (mostly older European-language printings) would create rows that
    // we'd never use in the dashboard charts.
    expect(eurOnly.price).toBeNull();
  });

  it("copies card_faces onto both the card and printing rows", () => {
    const card_faces = [
      { oracle_text: "Front face text" },
      { oracle_text: "Back face text" },
    ];
    const result = transformScryfallRow(scryfallRow({ card_faces }), today);
    if (result.skip != null) throw new Error("unexpected skip");
    expect(result.card.cardFaces).toBe(card_faces);
    expect(result.printing.cardFaces).toBe(card_faces);
  });
});

// ─── Streaming integration ─────────────────────────────────────

describe("syncScryfall (streaming)", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockInsertValues.mockReset();
    mockInsertOnConflict.mockClear();
    mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockInsertOnConflict });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it("skips when remote bulk file is not newer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              type: "default_cards",
              download_uri: "https://data.scryfall.io/default-cards.json",
              updated_at: "2020-01-01T00:00:00.000Z",
            },
          ],
        }),
      }),
    );
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { value: { updatedAt: "2024-01-01T00:00:00.000Z" } },
          ]),
        }),
      }),
    });

    const result = await syncScryfall({ source: "local" });
    expect(result.skipped).toBe(true);
  });

  it("throws when default_cards bulk metadata is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }),
    );

    await expect(syncScryfall({ source: "local" })).rejects.toThrow(
      /default_cards/i,
    );
  });

  it("streams the bulk JSON, transforms rows, and batches the upserts", async () => {
    // Two valid English cards + one Japanese skip + one no-oracle-id skip.
    const bulkArray = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        oracle_id: "22222222-2222-4222-8222-222222222222",
        name: "Lightning Bolt",
        lang: "en",
        set: "lea",
        set_name: "Limited Edition Alpha",
        collector_number: "162",
        type_line: "Instant",
        cmc: 1,
        legalities: { commander: "legal" },
        prices: { usd: "1.00", usd_foil: null },
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        oracle_id: "44444444-4444-4444-8444-444444444444",
        name: "Sol Ring",
        lang: "en",
        set: "lea",
        set_name: "Limited Edition Alpha",
        collector_number: "270",
        type_line: "Artifact",
        cmc: 1,
        legalities: { commander: "legal" },
        prices: { usd: "120.00", usd_foil: null },
      },
      // Japanese — should be skipped.
      {
        id: "55555555-5555-4555-8555-555555555555",
        oracle_id: "66666666-6666-4666-8666-666666666666",
        name: "稲妻",
        lang: "ja",
        set: "4ed",
        set_name: "Fourth Edition",
        collector_number: "1",
        type_line: "Instant",
      },
      // No oracle_id (e.g. token-like row) — should be skipped.
      {
        id: "77777777-7777-4777-8777-777777777777",
        name: "Goblin Token",
        lang: "en",
        set: "tokn",
        set_name: "Tokens",
        collector_number: "T1",
        type_line: "Token Creature — Goblin",
      },
    ];

    // First fetch (bulk metadata) returns the manifest; second fetch
    // (download_uri) returns a stream over the JSON array — the real
    // stream-json parser walks it end-to-end, so this test exercises the
    // actual streaming path, not a mocked iterator.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                type: "default_cards",
                download_uri: "https://data.scryfall.io/default-cards.json",
                updated_at: "2030-01-01T00:00:00.000Z",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          // Node's Readable has a `toWeb` static; the real fetch response
          // body is a WebStream that Readable.fromWeb wraps. Constructing
          // a Readable from a string and converting to web is the cleanest
          // way to inject a deterministic payload.
          body: Readable.toWeb(
            Readable.from([Buffer.from(JSON.stringify(bulkArray))]),
          ),
        }),
    );

    const result = await syncScryfall({ source: "local" });

    expect(result.count).toBe(2);
    expect(result.skipped).toBe(2);

    // First insert is the cards batch — assert the values shape so we
    // know the transform's output reached the upsert call site.
    const cardsValues = mockInsertValues.mock.calls[0]?.[0] as Array<{
      oracleId: string;
      name: string;
      isCommanderLegal: boolean;
    }>;
    expect(cardsValues).toHaveLength(2);
    expect(cardsValues.map((c) => c.name).sort()).toEqual([
      "Lightning Bolt",
      "Sol Ring",
    ]);
    expect(cardsValues.every((c) => c.isCommanderLegal)).toBe(true);

    // Second insert is the printings batch; third is price_history.
    const printingsValues = mockInsertValues.mock.calls[1]?.[0] as Array<{
      id: string;
    }>;
    expect(printingsValues).toHaveLength(2);

    const priceValues = mockInsertValues.mock.calls[2]?.[0] as Array<{
      printingId: string;
      usd: string | null;
    }>;
    expect(priceValues).toHaveLength(2);
    expect(priceValues.map((p) => p.usd).sort()).toEqual(["1.00", "120.00"]);
  });

  it("deduplicates cards by oracle_id within a single batch (last write wins)", async () => {
    // Two printings of the same card → same oracle_id, two printings rows
    // but only one card row in the upsert batch.
    const bulkArray = [
      {
        id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        oracle_id: "shared-oracle-id-here-1234-abcdef012345",
        name: "Sol Ring",
        lang: "en",
        set: "lea",
        set_name: "Limited Edition Alpha",
        collector_number: "270",
        type_line: "Artifact",
        legalities: { commander: "legal" },
      },
      {
        id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        oracle_id: "shared-oracle-id-here-1234-abcdef012345",
        name: "Sol Ring",
        lang: "en",
        set: "c21",
        set_name: "Commander 2021",
        collector_number: "5",
        type_line: "Artifact",
        legalities: { commander: "legal" },
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                type: "default_cards",
                download_uri: "https://data.scryfall.io/default-cards.json",
                updated_at: "2030-01-01T00:00:00.000Z",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: Readable.toWeb(
            Readable.from([Buffer.from(JSON.stringify(bulkArray))]),
          ),
        }),
    );

    await syncScryfall({ source: "local" });

    const cardsValues = mockInsertValues.mock.calls[0]?.[0] as unknown[];
    const printingsValues = mockInsertValues.mock.calls[1]?.[0] as unknown[];
    expect(cardsValues).toHaveLength(1);
    expect(printingsValues).toHaveLength(2);
  });
});
