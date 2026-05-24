// Contract test: every API route under src/app/api/* must be gated by
// src/proxy.ts. This pins the auth boundary so future matcher edits or
// new routes can't accidentally fall outside it.
//
// We rely on the proxy as the single auth surface (no in-handler
// auth.getUser() calls) to avoid 46+ extra Supabase round-trips on
// every request lifecycle. The trade-off — losing defense-in-depth —
// is acceptable for a single-user allowlist app, BUT only if we can
// catch matcher regressions immediately. That's what this test is.

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
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

// Walk src/app/api/ and return every route.ts as a URL path. [param]
// segments are kept as-is — the proxy matches on regex, not on
// resolved params, so the literal path works for this test.
function enumerateApiRoutes(): string[] {
  const apiRoot = resolve(__dirname, ".");
  const out: string[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, `${prefix}/${entry}`);
      } else if (entry === "route.ts") {
        out.push(`/api${prefix}`);
      }
    }
  }
  walk(apiRoot, "");
  return out.sort();
}

describe("API auth gate (contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.ALLOWED_EMAIL = "allowed@example.com";
    signOut.mockResolvedValue(undefined);
  });

  const routes = enumerateApiRoutes();
  const cronRoutes = routes.filter((p) => p.startsWith("/api/cron/"));
  const protectedRoutes = routes.filter((p) => !p.startsWith("/api/cron/"));

  it("discovers a non-trivial number of API routes", () => {
    // Sanity floor — if this drops we likely have a glob bug, not a
    // genuinely shrunk surface.
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(cronRoutes.length).toBeGreaterThan(0);
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });

  it.each(protectedRoutes)(
    "%s redirects unauthenticated callers to /login",
    async (path) => {
      getUser.mockResolvedValue({ data: { user: null } });
      const res = await proxy(req(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    },
  );

  it.each(cronRoutes)(
    "%s passes through without auth (cron paths use CRON_SECRET bearer)",
    async (path) => {
      getUser.mockResolvedValue({ data: { user: null } });
      const res = await proxy(req(path));
      // Pass-through means the proxy doesn't redirect; the handler
      // itself is responsible for verifying Authorization: Bearer
      // $CRON_SECRET.
      expect(res.status).toBe(200);
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it("/manifest.webmanifest and /sw.js bypass auth (PWA contract)", async () => {
    // The browser fetches these without credentials; if the proxy 307s
    // them to /login the PWA install + service worker registration
    // break. shouldBypassAuth exempts them. Re-asserted here so a
    // future matcher change can't silently re-gate them.
    getUser.mockResolvedValue({ data: { user: null } });
    for (const path of ["/manifest.webmanifest", "/sw.js"]) {
      const res = await proxy(req(path));
      expect(res.status).toBe(200);
    }
    expect(getUser).not.toHaveBeenCalled();
  });
});
