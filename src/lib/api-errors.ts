import { NextResponse } from "next/server";

/**
 * Standardized 500 response. The full error is logged server-side under the
 * given tag (visible in Vercel logs); the client gets a generic message
 * with no DB column names, stack traces, or other implementation leakage.
 *
 * Why this exists: raw `err.message` in 500s was leaking schema details
 * (e.g. "column p.card_faces does not exist") to the client. That's both an
 * info-disclosure smell and bad UX — users don't need to see SQL errors.
 *
 * The optional `code` is a short, stable identifier the client can
 * pattern-match on if it ever needs to (e.g. retry vs. surface-as-final).
 */
export function serverError(
  tag: string,
  err: unknown,
  message = "Something went wrong. Please try again.",
  code?: string,
) {
  console.error(`[${tag}]`, err);
  return NextResponse.json(
    code != null ? { error: message, code } : { error: message },
    { status: 500 },
  );
}
