// Open-redirect guard for the `next` query param on auth callbacks.
//
// The Supabase magic-link callback (and any future OAuth callback)
// honors a `next` param so the user lands back on the page they were
// trying to reach. Without validation, an attacker could craft a
// magic-link URL with `next=//evil.com/x` and steer the victim to a
// hostile origin after login — a classic open redirect.
//
// We accept only same-origin absolute paths:
//   - must start with a single `/`
//   - must NOT start with `//` (protocol-relative)
//   - must NOT start with `/\` (backslash-trick — browsers normalize
//     `\` to `/` after the redirect, turning `/\evil.com` into `//evil.com`)
//   - must NOT contain a scheme (`http:`, `javascript:`, `data:`, etc.)
//   - must parse to the same origin via `new URL(next, baseOrigin)`
//
// Anything that fails any check falls back to the supplied default.
export function safeNextPath(
  next: string | null | undefined,
  baseOrigin: string,
  defaultPath = "/dashboard",
): string {
  if (typeof next !== "string" || next.length === 0) return defaultPath;

  // Cheap structural checks first — these catch the common attack
  // shapes before we bother parsing.
  if (!next.startsWith("/")) return defaultPath;
  if (next.startsWith("//")) return defaultPath;
  if (next.startsWith("/\\")) return defaultPath;
  if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return defaultPath;

  // Final cross-check: resolve against the base origin and confirm
  // the resulting URL is same-origin. Catches anything URL-parser-
  // normalizes around that the structural checks missed.
  try {
    const target = new URL(next, baseOrigin);
    if (target.origin !== baseOrigin) return defaultPath;
    return target.pathname + target.search + target.hash;
  } catch {
    return defaultPath;
  }
}
