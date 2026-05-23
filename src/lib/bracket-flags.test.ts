import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

import {
  refreshAllBracketFlags,
  updateExtraTurnFlags,
  updateMldFlags,
  updateTutorFlags,
  updateGameChangerFlags,
} from "./bracket-flags";

describe("updateExtraTurnFlags", () => {
  beforeEach(() => mockExecute.mockReset());

  it("returns extra-turn count from database", async () => {
    mockExecute
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ count: 42 }]);
    await expect(updateExtraTurnFlags()).resolves.toBe(42);
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});

describe("updateMldFlags", () => {
  beforeEach(() => mockExecute.mockReset());

  it("updates MLD flags and returns count", async () => {
    mockExecute
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ count: 15 }]);
    await expect(updateMldFlags()).resolves.toBe(15);
  });
});

describe("updateTutorFlags", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ oracle_id: "11111111-1111-1111-1111-111111111111" }],
          has_more: false,
        }),
      }),
    );
  });

  it("fetches tutors from Scryfall and updates flags", async () => {
    mockExecute
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    await expect(updateTutorFlags()).resolves.toBe(1);
    expect(fetch).toHaveBeenCalled();
  });
});

describe("updateGameChangerFlags", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ oracle_id: "22222222-2222-2222-2222-222222222222" }],
          has_more: false,
        }),
      }),
    );
  });

  it("fetches game changers from Scryfall", async () => {
    mockExecute.mockResolvedValue(undefined);
    await expect(updateGameChangerFlags()).resolves.toBe(1);
  });
});

describe("refreshAllBracketFlags", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], has_more: false }),
      }),
    );
  });

  it("runs all flag steps and persists summary", async () => {
    mockExecute.mockResolvedValue([{ count: 0 }]);
    const summary = await refreshAllBracketFlags();
    expect(summary.errors).toEqual([]);
    expect(mockInsert).toHaveBeenCalled();
  });
});
