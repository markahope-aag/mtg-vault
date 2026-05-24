import { describe, expect, it } from "vitest";
import {
  assertNotHostileMarketplace,
  HostileMarketplaceError,
  isHostileMarketplace,
} from "./denylist";

describe("denylist", () => {
  it("refuses TCGPlayer subdomains", () => {
    expect(() =>
      assertNotHostileMarketplace("https://magic.tcgplayer.com/foo"),
    ).toThrow(HostileMarketplaceError);
    expect(() =>
      assertNotHostileMarketplace("https://tcgplayer.com/search"),
    ).toThrow(HostileMarketplaceError);
    expect(() =>
      assertNotHostileMarketplace("https://shop.tcgplayer.com/x"),
    ).toThrow(HostileMarketplaceError);
  });

  it("refuses Cardmarket", () => {
    expect(() =>
      assertNotHostileMarketplace("https://www.cardmarket.com/en/Magic"),
    ).toThrow(HostileMarketplaceError);
    expect(() =>
      assertNotHostileMarketplace("https://cardmarket.com/en"),
    ).toThrow(HostileMarketplaceError);
  });

  it("refuses eBay-the-site and points at the API instead", () => {
    expect(() =>
      assertNotHostileMarketplace("https://www.ebay.com/itm/123"),
    ).toThrow(/eBay Browse API adapter/);
    expect(() =>
      assertNotHostileMarketplace("https://ebay.co.uk/itm/x"),
    ).toThrow(/eBay Browse API adapter/);
  });

  it("allows friendly LGS-style targets", () => {
    expect(() =>
      assertNotHostileMarketplace("https://example-lgs.com/search?q=sol+ring"),
    ).not.toThrow();
    expect(() =>
      assertNotHostileMarketplace("https://gamenighthq.com/store"),
    ).not.toThrow();
    expect(() =>
      assertNotHostileMarketplace("https://misty-mountain-games.com"),
    ).not.toThrow();
  });

  it("silently passes malformed URLs (adapter will error on use)", () => {
    expect(() => assertNotHostileMarketplace("not-a-url")).not.toThrow();
    expect(() => assertNotHostileMarketplace("")).not.toThrow();
  });

  it("isHostileMarketplace returns a boolean for UI checks", () => {
    expect(isHostileMarketplace("https://tcgplayer.com")).toBe(true);
    expect(isHostileMarketplace("https://my-lgs.com")).toBe(false);
  });
});
