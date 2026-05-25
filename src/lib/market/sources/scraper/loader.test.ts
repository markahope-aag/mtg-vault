import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockExecute, register } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  register: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock("../../source", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../source")>();
  return {
    ...actual,
    marketSources: {
      register,
      all: actual.marketSources.all.bind(actual.marketSources),
      enabled: actual.marketSources.enabled.bind(actual.marketSources),
      get: actual.marketSources.get.bind(actual.marketSources),
    },
  };
});

import { AVAILABLE_PARSER_TEMPLATES, loadScraperSources } from "./loader";

describe("loadScraperSources", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    register.mockReset();
  });

  it("registers enabled shopify rows and skips hostile URLs", async () => {
    mockExecute.mockResolvedValueOnce([
      {
        source_key: "friendly-lgs",
        display_name: "Friendly LGS",
        base_url: "https://example-lgs.com",
        parser_template: "shopify",
        enabled: true,
        robots_acknowledged: true,
        rate_limit_per_minute: 5,
        rate_limit_per_day: 200,
        use_web_unlocker: false,
      },
      {
        source_key: "bad",
        display_name: "TCGPlayer",
        base_url: "https://tcgplayer.com",
        parser_template: "shopify",
        enabled: true,
        robots_acknowledged: true,
        rate_limit_per_minute: 5,
        rate_limit_per_day: 200,
        use_web_unlocker: false,
      },
    ]);

    await loadScraperSources();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0].id).toBe("friendly-lgs");
  });

  it("swallows errors when market_sources is missing", async () => {
    mockExecute.mockRejectedValueOnce(new Error("relation does not exist"));
    await expect(loadScraperSources()).resolves.toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });

  it("exposes shopify in AVAILABLE_PARSER_TEMPLATES", () => {
    expect(AVAILABLE_PARSER_TEMPLATES.map((t) => t.key)).toContain("shopify");
  });
});
