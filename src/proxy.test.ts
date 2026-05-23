import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser, signOut },
  }),
}));

import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.ALLOWED_EMAIL = "allowed@example.com";
    signOut.mockResolvedValue(undefined);
  });

  it("passes through cron routes without auth", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/api/cron/daily-snapshot"));
    expect(res.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects disallowed users and signs them out", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "other@example.com" } },
    });
    const res = await proxy(req("/inventory"));
    expect(signOut).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("not_allowed");
  });

  it("redirects allowlisted users away from login", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "allowed@example.com" } },
    });
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toContain("/dashboard");
  });
});
