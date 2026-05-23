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
  return path.startsWith("/api/cron");
}
