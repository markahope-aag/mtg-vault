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
