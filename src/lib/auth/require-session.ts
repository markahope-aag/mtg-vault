import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, parseAllowedEmails } from "./allowlist";

// Session gate for API routes. Layered on top of the proxy's allowlist
// check (which handles unauthenticated → 307 /login). This helper is
// for routes that need the authenticated User object inside the
// handler — e.g. for audit logging, surfacing the user's email back,
// or future per-user data isolation.
//
// Routes do NOT need to call this for basic auth — the proxy already
// gates by allowlist and the auth-gate contract test
// (src/app/api/auth-gate.test.ts) pins that behavior. Use this when
// you actively want the user identity in scope.
//
// Returns:
//   { ok: true, user }   — user is authenticated AND on the allowlist
//   { ok: false, res }   — return `res` directly; it's a 401 / 403
//                           Response with a clean error shape

export type RequireSessionResult =
  | { ok: true; user: User }
  | { ok: false; res: Response };

export async function requireSession(): Promise<RequireSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const allow = parseAllowedEmails(process.env.ALLOWED_EMAIL);
  if (!isAllowedEmail(user.email, allow)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
