import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import {
  validateCommanderPrinting,
  validatePartnerPrinting,
} from "./validation";

const PRINTING_ID = "11111111-1111-4111-8111-111111111111";

describe("validateCommanderPrinting", () => {
  beforeEach(() => mockExecute.mockReset());

  it("accepts legendary creatures", async () => {
    mockExecute.mockResolvedValueOnce([
      { type_line: "Legendary Creature — Human", oracle_text: "" },
    ]);
    const result = await validateCommanderPrinting(PRINTING_ID);
    expect(result).toEqual({ ok: true });
  });

  it("accepts planeswalkers with commander clause", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        type_line: "Legendary Planeswalker — Tevesh",
        oracle_text: "Tevesh Szat, Doom of Princes can be your commander.",
      },
    ]);
    const result = await validateCommanderPrinting(PRINTING_ID);
    expect(result).toEqual({ ok: true });
  });

  it("rejects non-commanders", async () => {
    mockExecute.mockResolvedValueOnce([
      { type_line: "Instant", oracle_text: "Draw a card." },
    ]);
    const result = await validateCommanderPrinting(PRINTING_ID);
    expect(result.ok).toBe(false);
  });

  it("handles missing printing", async () => {
    mockExecute.mockResolvedValueOnce([]);
    const result = await validateCommanderPrinting(PRINTING_ID);
    expect(result).toEqual({ ok: false, reason: "printing not found" });
  });
});

describe("validatePartnerPrinting", () => {
  beforeEach(() => mockExecute.mockReset());

  it("requires Partner on commander", async () => {
    mockExecute.mockResolvedValueOnce([{ oracle_text: "Partner" }]);
    const result = await validatePartnerPrinting(
      PRINTING_ID,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects commanders without Partner", async () => {
    mockExecute.mockResolvedValueOnce([{ oracle_text: "Flying" }]);
    const result = await validatePartnerPrinting(
      PRINTING_ID,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(result.ok).toBe(false);
  });
});
