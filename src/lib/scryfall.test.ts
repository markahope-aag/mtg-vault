import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/lib/bracket-flags", () => ({
  updateExtraTurnFlags: vi.fn().mockResolvedValue(1),
  updateMldFlags: vi.fn().mockResolvedValue(2),
  updateTutorFlags: vi.fn().mockResolvedValue(3),
}));

import { syncScryfall, syncTutors } from "./scryfall";
import { updateTutorFlags } from "@/lib/bracket-flags";

describe("syncTutors", () => {
  it("delegates to updateTutorFlags", async () => {
    await expect(syncTutors()).resolves.toEqual({ count: 3 });
    expect(updateTutorFlags).toHaveBeenCalled();
  });
});

describe("syncScryfall", () => {
  beforeEach(() => {
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
});
