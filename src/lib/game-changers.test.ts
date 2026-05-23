import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bracket-flags", () => ({
  updateGameChangerFlags: vi.fn().mockResolvedValue(7),
}));

import { syncGameChangers } from "./game-changers";
import { updateGameChangerFlags } from "@/lib/bracket-flags";

describe("syncGameChangers", () => {
  it("delegates to updateGameChangerFlags", async () => {
    await expect(syncGameChangers()).resolves.toEqual({ count: 7 });
    expect(updateGameChangerFlags).toHaveBeenCalled();
  });
});
