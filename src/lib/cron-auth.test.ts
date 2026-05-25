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

  it("returns 401 when bearer token is wrong (same length)", () => {
    // Same length as "test-secret" (11 chars) — exercises the
    // XOR-fold branch rather than the length-mismatch fast path.
    const res = checkCronAuth(cronRequest("/api/cron/x", "wrong-token"))!;
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token is wrong length (shorter)", () => {
    const res = checkCronAuth(cronRequest("/api/cron/x", "wrong"))!;
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token is wrong length (longer)", () => {
    const res = checkCronAuth(
      cronRequest("/api/cron/x", "test-secret-and-more"),
    )!;
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is missing", () => {
    const req = new Request("http://localhost/api/cron/x");
    const res = checkCronAuth(req)!;
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header lacks the Bearer prefix", () => {
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: "test-secret" },
    });
    const res = checkCronAuth(req)!;
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const res = checkCronAuth(cronRequest("/api/cron/x", "test-secret"))!;
    expect(res.status).toBe(500);
  });
});
