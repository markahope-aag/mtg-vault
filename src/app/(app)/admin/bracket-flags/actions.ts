"use server";

import { revalidatePath } from "next/cache";
import { refreshAllBracketFlags } from "@/lib/bracket-flags";
import { requireAdminUser } from "@/lib/auth/require-admin";

export type RefreshActionResult =
  | { ok: true; summary: Awaited<ReturnType<typeof refreshAllBracketFlags>> }
  | { ok: false; error: string };

export async function refreshBracketFlagsAction(): Promise<RefreshActionResult> {
  // Server Actions are reachable via direct POST to their host page —
  // not through the API route handlers — so they need the admin check
  // here too (the proxy gates the page, but a crafted POST bypassing
  // the page render still hits this function).
  await requireAdminUser();
  try {
    const summary = await refreshAllBracketFlags();
    revalidatePath("/admin/bracket-flags");
    return { ok: true, summary };
  } catch (err) {
    // Log the full error server-side (with tag, matching the
    // lib/api-errors.ts convention used by every other 500 path) and
    // return a generic message to the client. Server Action results
    // get serialized into the page, so a raw err.message could leak
    // SQL column names, Scryfall response shapes, etc. into the DOM.
    console.error("[admin/bracket-flags/action]", err);
    return {
      ok: false,
      error: "Couldn't refresh bracket flags. Check the server logs.",
    };
  }
}
