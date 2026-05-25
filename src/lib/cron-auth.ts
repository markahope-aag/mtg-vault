/**
 * Constant-time string compare. JS `===` / `!==` on strings short-
 * circuits at the first mismatched code unit, leaking the secret one
 * character per timing measurement. This XOR-folds every position
 * before checking, so the runtime depends only on the lengths.
 *
 * Returns false for different-length inputs (length is not the secret
 * — it's effectively public the moment a deploy ships).
 *
 * Manual implementation rather than `crypto.timingSafeEqual` so the
 * function works unchanged if a cron route is ever moved to the Edge
 * runtime, where Node's `crypto` module isn't available.
 */
function timingSafeStrEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function checkCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const header = req.headers.get("authorization");
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Compare only the token portion. The "Bearer " prefix is public
  // and including it in the timing-safe compare would just add a
  // fixed overhead.
  const provided = header.slice(prefix.length);
  if (!timingSafeStrEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
