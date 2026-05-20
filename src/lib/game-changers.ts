import { updateGameChangerFlags } from "@/lib/bracket-flags";

// Thin wrapper retained for the standalone seed script. Canonical logic
// lives in bracket-flags.ts so the cron + admin tooling share it.
export async function syncGameChangers() {
  const count = await updateGameChangerFlags();
  return { count };
}
