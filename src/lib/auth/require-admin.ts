import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isAdminEmail,
  parseAdminEmails,
  parseAllowedEmails,
} from "./allowlist";

// Admin gate, layered on top of the proxy's allowlist check. Two
// flavors — one for API routes (returns a Response or null), one for
// pages / Server Actions (redirects on miss, returns the user object
// on hit). Both resolve the admin list as:
//   ADMIN_EMAIL (comma-separated) if set
//   else ALLOWED_EMAIL (fallback so single-user deploys keep working)
//
// Why both check at all when the proxy already gates by allowlist:
// adding a second allowlisted user (partner, friend, future shared
// instance) would otherwise auto-inherit admin. This split lets the
// allowlist grow without grants escalating.

function resolveAdminList(): string[] {
  const allow = parseAllowedEmails(process.env.ALLOWED_EMAIL);
  return parseAdminEmails(process.env.ADMIN_EMAIL, allow);
}

/**
 * For API route handlers. Returns null when the caller is admin
 * (continue handling the request) or a Response when they're not
 * (return it directly).
 */
export async function requireAdmin(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admins = resolveAdminList();
  if (!isAdminEmail(user.email, admins)) {
    return NextResponse.json({ error: "Admin access required" }, {
      status: 403,
    });
  }
  return null;
}

/**
 * For Server Components, Server Actions, and pages. Redirects to
 * /dashboard?error=not_admin on miss; returns the user object on hit.
 *
 * Uses next/navigation `redirect()`, which throws a special control-
 * flow error TypeScript correctly types as `never`.
 */
export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const admins = resolveAdminList();
  if (!isAdminEmail(user.email, admins)) {
    redirect("/dashboard?error=not_admin");
  }
  return user;
}
