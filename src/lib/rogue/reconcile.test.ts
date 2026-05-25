import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { bucketFor, reconcile, type HeldByDeck } from "./reconcile";

// ─── Pure bucket logic ─────────────────────────────────────────

describe("bucketFor", () => {
  function held(deckId: string, qty: number, isProtected = false): HeldByDeck {
    return { deckId, deckName: `Deck ${deckId}`, qty, isProtected };
  }

  it("returns must_buy when ownedCount is 0", () => {
    expect(
      bucketFor({
        ownedCount: 0,
        committedTotal: 0,
        heldByDecks: [],
        requested: 1,
        protectedDeckIds: new Set(),
        isUnlimited: false,
      }),
    ).toBe("must_buy");
  });

  it("returns available_now for unlimited cards regardless of ownership", () => {
    // Basics + any-number-allowed: even with zero copies you can always
    // acquire more freely; never block the deck.
    expect(
      bucketFor({
        ownedCount: 0,
        committedTotal: 0,
        heldByDecks: [],
        requested: 30,
        protectedDeckIds: new Set(),
        isUnlimited: true,
      }),
    ).toBe("available_now");
  });

  it("returns available_now when free copies exceed requested", () => {
    expect(
      bucketFor({
        ownedCount: 3,
        committedTotal: 1,
        heldByDecks: [held("a", 1)],
        requested: 1,
        protectedDeckIds: new Set(),
        isUnlimited: false,
      }),
    ).toBe("available_now");
  });

  it("returns movable when all copies are committed to non-protected decks", () => {
    expect(
      bucketFor({
        ownedCount: 1,
        committedTotal: 1,
        heldByDecks: [held("a", 1)],
        requested: 1,
        protectedDeckIds: new Set(),
        isUnlimited: false,
      }),
    ).toBe("movable");
  });

  it("returns must_buy when every holder is protected", () => {
    // Single copy, in a protected deck — we can't pull it, so it's
    // effectively a must_buy even though we own one.
    expect(
      bucketFor({
        ownedCount: 1,
        committedTotal: 1,
        heldByDecks: [held("a", 1, true)],
        requested: 1,
        protectedDeckIds: new Set(["a"]),
        isUnlimited: false,
      }),
    ).toBe("must_buy");
  });

  it("returns contested when total claimants exceed ownedCount", () => {
    // We own 1, two existing decks already share it, the proposal asks
    // for a third. That's contended — surface it.
    expect(
      bucketFor({
        ownedCount: 1,
        committedTotal: 2,
        heldByDecks: [held("a", 1), held("b", 1)],
        requested: 1,
        protectedDeckIds: new Set(),
        isUnlimited: false,
      }),
    ).toBe("contested");
  });
});

// ─── Full reconcile() flow ─────────────────────────────────────

describe("reconcile (SQL-backed)", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("returns the empty result for an empty target list", async () => {
    const result = await reconcile({ targetOracleIds: [] });
    expect(result.buckets.available_now).toHaveLength(0);
    expect(result.summary.totalCards).toBe(0);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("buckets cards by ownership / commitment / unlimited", async () => {
    mockExecute.mockResolvedValueOnce([
      // owned & free
      {
        oracle_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        name: "Sol Ring",
        type_line: "Artifact",
        owned_count: 1,
        committed_total: 0,
        cheapest_printing_id: "p-sol",
        cheapest_usd: "1.50",
        held_by: null,
      },
      // owned but committed to one non-protected deck → movable
      {
        oracle_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        name: "Counterspell",
        type_line: "Instant",
        owned_count: 1,
        committed_total: 1,
        cheapest_printing_id: "p-cs",
        cheapest_usd: "0.50",
        held_by: [
          { deckId: "deck-a", deckName: "Deck A", qty: 1, isPrimary: false },
        ],
      },
      // not owned → must_buy
      {
        oracle_id: "cccccccc-3333-4333-8333-cccccccccccc",
        name: "Cyclonic Rift",
        type_line: "Instant",
        owned_count: 0,
        committed_total: 0,
        cheapest_printing_id: "p-cr",
        cheapest_usd: "12.00",
        held_by: null,
      },
      // basic land — always available_now regardless of "ownership"
      {
        oracle_id: "dddddddd-4444-4444-8444-dddddddddddd",
        name: "Mountain",
        type_line: "Basic Land — Mountain",
        owned_count: 0,
        committed_total: 0,
        cheapest_printing_id: "p-mtn",
        cheapest_usd: "0.10",
        held_by: null,
      },
    ]);

    const result = await reconcile({
      targetOracleIds: [
        "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        "cccccccc-3333-4333-8333-cccccccccccc",
        // Mountain ×3
        "dddddddd-4444-4444-8444-dddddddddddd",
        "dddddddd-4444-4444-8444-dddddddddddd",
        "dddddddd-4444-4444-8444-dddddddddddd",
      ],
    });

    expect(result.buckets.available_now.map((c) => c.name).sort()).toEqual([
      "Mountain",
      "Sol Ring",
    ]);
    expect(result.buckets.movable.map((c) => c.name)).toEqual(["Counterspell"]);
    expect(result.buckets.must_buy.map((c) => c.name)).toEqual([
      "Cyclonic Rift",
    ]);
    expect(result.buckets.contested).toHaveLength(0);

    // Mountain x3 should preserve requested count for the totalCards sum.
    expect(result.summary.totalCards).toBe(6);

    // Scenarios sanity-check.
    expect(result.scenarios.buy_everything.totalCostUsd).toBe(12);
    expect(result.scenarios.cannibalize_freely.totalCostUsd).toBe(12);
    expect(result.scenarios.cannibalize_freely.cardsPulledFromDecks).toEqual([
      { oracleId: expect.any(String), name: "Counterspell", fromDeck: "Deck A" },
    ]);
    expect(result.scenarios.cannibalize_freely.decksImpacted).toEqual([
      { deckId: "deck-a", deckName: "Deck A", cardsLost: 1 },
    ]);
  });

  it("surfaces pre-existing contention separately from the proposal's demand", async () => {
    // Sol Ring: owned 1, committed 2 across two existing decks → already
    // over-claimed before this proposal even adds its own claim.
    mockExecute.mockResolvedValueOnce([
      {
        oracle_id: "11111111-1111-4111-8111-111111111111",
        name: "Sol Ring",
        type_line: "Artifact",
        owned_count: 1,
        committed_total: 2,
        cheapest_printing_id: "p1",
        cheapest_usd: "1.50",
        held_by: [
          { deckId: "deck-a", deckName: "A", qty: 1, isPrimary: false },
          { deckId: "deck-b", deckName: "B", qty: 1, isPrimary: false },
        ],
      },
    ]);

    const result = await reconcile({
      targetOracleIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(result.preExistingContention).toEqual([
      {
        oracleId: "11111111-1111-4111-8111-111111111111",
        name: "Sol Ring",
        ownedCount: 1,
        claimedByDecks: 2,
      },
    ]);
    // It's also contested for the proposal (claimants=3 > owned=1).
    expect(result.buckets.contested.map((c) => c.name)).toEqual(["Sol Ring"]);
  });

  it("marks primary-deck-held cards as must_buy in the protect_primary scenario", async () => {
    mockExecute.mockResolvedValueOnce([
      // Owned 1, held by a primary deck → movable → must_buy under
      // protect_primary because we can't cannibalize the primary.
      {
        oracle_id: "22222222-2222-4222-8222-222222222222",
        name: "Smothering Tithe",
        type_line: "Enchantment",
        owned_count: 1,
        committed_total: 1,
        cheapest_printing_id: "p-st",
        cheapest_usd: "20.00",
        held_by: [
          {
            deckId: "deck-primary",
            deckName: "Primary",
            qty: 1,
            isPrimary: true,
          },
        ],
      },
    ]);

    const result = await reconcile({
      targetOracleIds: ["22222222-2222-4222-8222-222222222222"],
    });

    // protect_primary scenario shopping list should include it.
    const protectShop = result.scenarios.protect_primary.shoppingList;
    expect(protectShop.map((c) => c.name)).toContain("Smothering Tithe");
    // cannibalize_freely respects isPrimary too (heldByDecks.isProtected
    // is set when isPrimary), so this should also fall to shopping here.
    expect(
      result.scenarios.cannibalize_freely.cardsPulledFromDecks.map(
        (c) => c.name,
      ),
    ).not.toContain("Smothering Tithe");
  });

  it("splits must_buy cards above/below the price threshold", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        oracle_id: "33333333-3333-4333-8333-333333333333",
        name: "Penny Common",
        type_line: "Instant",
        owned_count: 0,
        committed_total: 0,
        cheapest_printing_id: "p-pc",
        cheapest_usd: "0.10",
        held_by: null,
      },
      {
        oracle_id: "44444444-4444-4444-8444-444444444444",
        name: "Chase Mythic",
        type_line: "Creature",
        owned_count: 0,
        committed_total: 0,
        cheapest_printing_id: "p-cm",
        cheapest_usd: "45.00",
        held_by: null,
      },
    ]);

    const result = await reconcile({
      targetOracleIds: [
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
      ],
      priceThreshold: 5,
    });

    const split = result.scenarios.price_threshold_split;
    expect(split.decksImpacted).toEqual([
      { deckId: "__cheap__", deckName: "Under $5", cardsLost: 1 },
      { deckId: "__expensive__", deckName: "$5 and up", cardsLost: 1 },
    ]);
    expect(split.totalCostUsd).toBe(45.1);
  });

  it("buckets partial free stock as available_now when owned exceeds committed", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        oracle_id: "55555555-5555-4555-8555-555555555555",
        name: "Lightning Bolt",
        type_line: "Instant",
        owned_count: 3,
        committed_total: 1,
        cheapest_printing_id: "p-bolt",
        cheapest_usd: "2.00",
        held_by: [{ deckId: "deck-a", deckName: "A", qty: 1, isPrimary: false }],
      },
    ]);

    const result = await reconcile({
      targetOracleIds: ["55555555-5555-4555-8555-555555555555"],
    });
    expect(result.buckets.available_now.map((c) => c.name)).toEqual([
      "Lightning Bolt",
    ]);
  });
});
