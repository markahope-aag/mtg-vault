import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

import { configureLimiter, scrapeFetch } from "./runtime";

function okResponse(body = "<html>ok</html>", status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => body,
  };
}

describe("scrapeFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    configureLimiter("test-src", { perMinute: 100, perDay: 1000 });
  });

  it("returns ok:true with body on a successful plain fetch", async () => {
    fetchMock.mockResolvedValueOnce(okResponse("page body"));
    const result = await scrapeFetch({
      url: "https://example-lgs.com/cards",
      sourceKey: "test-src",
      useWebUnlocker: false,
    });
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      body: "page body",
      url: "https://example-lgs.com/cards",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://example-lgs.com/cards");
    expect(fetchMock.mock.calls[0][1]?.headers?.["User-Agent"]).toContain(
      "MTG-Vault",
    );
  });

  it("does not retry permanent 4xx responses", async () => {
    fetchMock.mockResolvedValue(okResponse("", 404));
    const result = await scrapeFetch({
      url: "https://example-lgs.com/missing",
      sourceKey: "test-src",
      useWebUnlocker: false,
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse("", 503))
      .mockResolvedValueOnce(okResponse("recovered"));
    const result = await scrapeFetch({
      url: "https://example-lgs.com/flaky",
      sourceKey: "test-src",
      useWebUnlocker: false,
    });
    expect(result).toMatchObject({ ok: true, body: "recovered" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses further fetches after the per-day limit is exceeded", async () => {
    configureLimiter("limited", { perMinute: 100, perDay: 1 });
    fetchMock.mockResolvedValue(okResponse("one"));
    const first = await scrapeFetch({
      url: "https://example-lgs.com/a",
      sourceKey: "limited",
      useWebUnlocker: false,
    });
    expect(first.ok).toBe(true);

    const second = await scrapeFetch({
      url: "https://example-lgs.com/b",
      sourceKey: "limited",
      useWebUnlocker: false,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("Per-day rate limit");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when Bright Data is requested without a token", async () => {
    const orig = process.env.BRIGHTDATA_API_TOKEN;
    delete process.env.BRIGHTDATA_API_TOKEN;
    const result = await scrapeFetch({
      url: "https://protected.example.com",
      sourceKey: "test-src",
      useWebUnlocker: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("BRIGHTDATA_API_TOKEN");
    }
    process.env.BRIGHTDATA_API_TOKEN = orig;
  });
});
