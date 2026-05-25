import { describe, expect, it } from "vitest";
import { ShopifyTemplate } from "./templates/shopify";

describe("ScraperSource base", () => {
  it("requires robots_acknowledged before enabling", () => {
    const t = new ShopifyTemplate({
      sourceKey: "locked",
      displayName: "Locked",
      baseUrl: "https://example-lgs.com",
      enabled: true,
      robotsAcknowledged: false,
      rateLimitPerMinute: 5,
      rateLimitPerDay: 200,
      useWebUnlocker: false,
    });
    expect(t.enabled).toBe(false);
  });

  it("refuses hostile marketplace URLs at construction", () => {
    expect(
      () =>
        new ShopifyTemplate({
          sourceKey: "bad",
          displayName: "Bad",
          baseUrl: "https://tcgplayer.com",
          enabled: true,
          robotsAcknowledged: true,
          rateLimitPerMinute: 5,
          rateLimitPerDay: 200,
          useWebUnlocker: false,
        }),
    ).toThrow(/hostile marketplace/i);
  });
});
