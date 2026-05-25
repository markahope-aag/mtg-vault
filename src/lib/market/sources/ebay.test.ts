import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();

vi.hoisted(() => {
  process.env.EBAY_APP_ID = "test-app";
  process.env.EBAY_CERT_ID = "test-cert";
  process.env.EBAY_OAUTH_TOKEN = "test-token";
});

vi.stubGlobal("fetch", fetchMock);

import { marketSources } from "../source";
import "./ebay";

const ebay = marketSources.get("ebay")!;

describe("eBay adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("is enabled when all three credentials are present", () => {
    expect(ebay.enabled).toBe(true);
    expect(ebay.hasSoldData).toBe(false);
  });

  it("returns empty when disabled", async () => {
    const prev = ebay.enabled;
    ebay.enabled = false;
    const listings = await ebay.search({ name: "Sol Ring" });
    ebay.enabled = prev;
    expect(listings).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps Browse API item summaries into MarketListings", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        itemSummaries: [
          {
            itemId: "123",
            title: "Sol Ring NM Commander",
            itemWebUrl: "https://ebay.com/itm/123",
            price: { value: "2.50", currency: "USD" },
            shippingOptions: [{ shippingCost: { value: "0.99", currency: "USD" } }],
            condition: "Used",
          },
          {
            itemId: "bad",
            title: "Free proxy",
            itemWebUrl: "https://ebay.com/itm/bad",
            price: { value: "0", currency: "USD" },
          },
        ],
      }),
    });

    const listings = await ebay.search({
      name: "Sol Ring",
      oracleId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      setCode: "c21",
      limit: 10,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toContain("/item_summary/search");
    expect(url.searchParams.get("q")).toContain("Sol Ring");
    expect(url.searchParams.get("category_ids")).toBe("38292");

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      sourceId: "ebay",
      oracleId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      rawTitle: "Sol Ring NM Commander",
      priceUsd: 2.5,
      shippingUsd: 0.99,
      condition: "NM",
      isSold: false,
    });
    expect(listings[0].confidence).toBeGreaterThan(0.5);
  });

  it("returns empty on HTTP errors without throwing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });

    const listings = await ebay.search({ name: "Sol Ring" });
    expect(listings).toEqual([]);
  });

  it("returns empty when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const listings = await ebay.search({ name: "Sol Ring" });
    expect(listings).toEqual([]);
  });

  it("lowers confidence for graded and lot titles", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        itemSummaries: [
          {
            itemId: "lot",
            title: "4x Sol Ring PSA 10 lot",
            itemWebUrl: "https://ebay.com/itm/lot",
            price: { value: "5.00", currency: "USD" },
          },
        ],
      }),
    });

    const listings = await ebay.search({ name: "Sol Ring" });
    expect(listings[0].flags).toContain("possible_lot");
    expect(listings[0].flags).toContain("graded");
    expect(listings[0].confidence).toBeLessThan(0.5);
  });
});
