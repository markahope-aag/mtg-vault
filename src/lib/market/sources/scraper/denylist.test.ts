import { describe, expect, it } from "vitest";
import {
  assertNotHostileMarketplace,
  HostileMarketplaceError,
  isHostileMarketplace,
  UnsafeUrlError,
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

  // ─── SSRF guard ────────────────────────────────────────────────

  it("refuses cloud-metadata IPv4 (169.254.169.254)", () => {
    expect(() =>
      assertNotHostileMarketplace("http://169.254.169.254/latest/meta-data/"),
    ).toThrow(UnsafeUrlError);
  });

  it("refuses cloud-metadata hostnames", () => {
    expect(() =>
      assertNotHostileMarketplace("http://metadata.google.internal/"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://metadata.azure.com/"),
    ).toThrow(UnsafeUrlError);
  });

  it("refuses loopback IPv4 + IPv6", () => {
    expect(() =>
      assertNotHostileMarketplace("http://127.0.0.1:3000/api"),
    ).toThrow(UnsafeUrlError);
    expect(() => assertNotHostileMarketplace("http://[::1]/api")).toThrow(
      UnsafeUrlError,
    );
  });

  it("refuses RFC1918 private IPv4 ranges", () => {
    for (const url of [
      "http://10.0.0.1/x",
      "http://10.255.255.255/x",
      "http://172.16.0.1/x",
      "http://172.31.255.254/x",
      "http://192.168.1.1/x",
    ]) {
      expect(() => assertNotHostileMarketplace(url)).toThrow(UnsafeUrlError);
    }
  });

  it("ALLOWS public IPv4 just outside the RFC1918 ranges", () => {
    // Spot-check the edges so the range math doesn't accidentally
    // exclude legit public IPs (172.15.x and 172.32.x are public).
    expect(() =>
      assertNotHostileMarketplace("http://172.15.0.1/x"),
    ).not.toThrow();
    expect(() =>
      assertNotHostileMarketplace("http://172.32.0.1/x"),
    ).not.toThrow();
    expect(() =>
      assertNotHostileMarketplace("http://11.0.0.1/x"),
    ).not.toThrow();
  });

  it("refuses link-local IPv6 (fe80::/10) and unique-local (fc00::/7)", () => {
    expect(() =>
      assertNotHostileMarketplace("http://[fe80::1]/api"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://[fc00::1]/api"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://[fd12:3456:789a::1]/api"),
    ).toThrow(UnsafeUrlError);
  });

  it("refuses localhost / .local / .internal / .localhost suffixes", () => {
    expect(() =>
      assertNotHostileMarketplace("http://localhost:3000/x"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://api.internal/x"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://printer.local/x"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("http://foo.localhost/x"),
    ).toThrow(UnsafeUrlError);
  });

  it("refuses non-http(s) schemes outright", () => {
    expect(() =>
      assertNotHostileMarketplace("file:///etc/passwd"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("ftp://ftp.example.com/"),
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertNotHostileMarketplace("gopher://example.com:70/"),
    ).toThrow(UnsafeUrlError);
  });
});
