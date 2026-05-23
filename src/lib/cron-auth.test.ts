import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { checkCronAuth } from "./cron-auth";
import { cronRequest } from "@/test/helpers";

describe("checkCronAuth", () => {
  const prev = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = prev;
  });

  it("returns null when bearer token matches", () => {
    expect(checkCronAuth(cronRequest("/api/cron/x", "test-secret"))).toBeNull();
  });

  it("returns 401 when bearer token is wrong", () => {
    const res = checkCronAuth(cronRequest("/api/cron/x", "wrong"))!;
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const res = checkCronAuth(cronRequest("/api/cron/x", "test-secret"))!;
    expect(res.status).toBe(500);
  });
});
