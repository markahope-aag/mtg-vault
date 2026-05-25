export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(
  email: string | null | undefined,
  allowList: readonly string[],
): boolean {
  if (!email) return false;
  return allowList.includes(email.toLowerCase());
}

export function isAuthRoutePath(path: string): boolean {
  return path.startsWith("/login") || path.startsWith("/auth/");
}

/**
 * Admin allowlist parser. Falls back to the regular allowlist when
 * ADMIN_EMAIL is unset so existing single-user deploys don't lose
 * admin access on upgrade. Adding a second non-admin user later
 * means setting ADMIN_EMAIL explicitly — at that point ALLOWED_EMAIL
 * and ADMIN_EMAIL diverge and admin access becomes a separate grant.
 */
export function parseAdminEmails(
  raw: string | undefined,
  allowList: readonly string[],
): string[] {
  const explicit = parseAllowedEmails(raw);
  return explicit.length > 0 ? explicit : [...allowList];
}

export function isAdminEmail(
  email: string | null | undefined,
  adminList: readonly string[],
): boolean {
  if (!email) return false;
  return adminList.includes(email.toLowerCase());
}

export function shouldBypassAuth(path: string): boolean {
  // The PWA manifest is fetched by the browser WITHOUT credentials
  // (the <link rel="manifest"> tag uses no crossorigin), so the auth
  // proxy would 307 it to /login → HTML → "Manifest: Line 1, col 1"
  // syntax error on every page. Manifest contents are public anyway.
  if (path === "/manifest.webmanifest") return true;
  // Same reasoning for the service worker registration — the browser
  // fetches /sw.js from the SW thread which doesn't carry app cookies.
  if (path === "/sw.js") return true;
  return path.startsWith("/api/cron");
}
