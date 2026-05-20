"use server";

import { revalidatePath } from "next/cache";
import { refreshAllBracketFlags } from "@/lib/bracket-flags";

export type RefreshActionResult =
  | { ok: true; summary: Awaited<ReturnType<typeof refreshAllBracketFlags>> }
  | { ok: false; error: string };

export async function refreshBracketFlagsAction(): Promise<RefreshActionResult> {
  try {
    const summary = await refreshAllBracketFlags();
    revalidatePath("/admin/bracket-flags");
    return { ok: true, summary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
