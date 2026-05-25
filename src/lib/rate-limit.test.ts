import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitsForTests, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimitsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permits the first N requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = rateLimit("k", 5);
      expect(result.ok).toBe(true);
    }
  });

  it("returns ok=false on the (limit+1)th request in-window", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5);
    const result = rateLimit("k", 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("isolates keys", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5);
    // 'a' is now over its limit; 'b' is untouched.
    expect(rateLimit("a", 5).ok).toBe(false);
    expect(rateLimit("b", 5).ok).toBe(true);
  });

  it("rolls over after the window elapses", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5);
    expect(rateLimit("k", 5).ok).toBe(false);

    vi.advanceTimersByTime(60_000);

    // New window — fresh budget.
    expect(rateLimit("k", 5).ok).toBe(true);
  });

  it("does NOT roll over mid-window", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5);
    vi.advanceTimersByTime(30_000); // half-way through the default window
    expect(rateLimit("k", 5).ok).toBe(false);
  });

  it("reports decreasing remaining counts", () => {
    const a = rateLimit("k", 3);
    const b = rateLimit("k", 3);
    const c = rateLimit("k", 3);
    expect(a.ok && a.remaining).toBe(2);
    expect(b.ok && b.remaining).toBe(1);
    expect(c.ok && c.remaining).toBe(0);
  });

  it("honors a custom window length", () => {
    rateLimit("k", 2, 10_000);
    rateLimit("k", 2, 10_000);
    expect(rateLimit("k", 2, 10_000).ok).toBe(false);

    vi.advanceTimersByTime(10_000);
    expect(rateLimit("k", 2, 10_000).ok).toBe(true);
  });

  it("retryAfterSec is at least 1 second", () => {
    rateLimit("k", 1);
    const result = rateLimit("k", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
  });
});
