import { describe, expect, it } from "vitest";
import { ShopifyTemplate } from "./shopify";

const config = {
  sourceKey: "test-shop",
  displayName: "Test Shop",
  baseUrl: "https://example-lgs.com",
  enabled: true,
  robotsAcknowledged: true,
  rateLimitPerMinute: 10,
  rateLimitPerDay: 500,
  useWebUnlocker: false,
};

function parseListings(
  template: ShopifyTemplate,
  raw: string,
  query: { name: string; oracleId?: string },
) {
  return (
    template as unknown as {
      parseListings: (
        raw: string,
        query: { name: string; oracleId?: string },
      ) => import("../../../source").MarketListing[];
    }
  ).parseListings(raw, query);
}

describe("ShopifyTemplate", () => {
  it("builds suggest.json search URLs", () => {
    const t = new ShopifyTemplate(config);
    const url = (
      t as unknown as { buildSearchUrl: (q: { name: string }) => string }
    ).buildSearchUrl({ name: "Sol Ring" });
    expect(url).toContain("/search/suggest.json");
    expect(url).toContain("q=Sol+Ring");
  });

  it("parses product JSON into listings", () => {
    const t = new ShopifyTemplate(config);
    const body = JSON.stringify({
      resources: {
        results: {
          products: [
            {
              title: "Sol Ring NM",
              url: "/products/sol-ring",
              price: "$2.50",
              available: true,
              product_id: 99,
            },
            {
              title: "Unrelated playmat",
              url: "/products/mat",
              price: "$10.00",
              available: true,
            },
          ],
        },
      },
    });
    const listings = parseListings(t, body, {
      name: "Sol Ring",
      oracleId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    });
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      sourceId: "test-shop",
      rawTitle: "Sol Ring NM",
      priceUsd: 2.5,
      oracleId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    });
    expect(listings[0].url).toBe("https://example-lgs.com/products/sol-ring");
  });

  it("returns empty for invalid JSON", () => {
    const t = new ShopifyTemplate(config);
    expect(parseListings(t, "<html>nope</html>", { name: "Sol Ring" })).toEqual(
      [],
    );
  });
});
