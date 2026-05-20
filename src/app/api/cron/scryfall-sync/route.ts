import { checkCronAuth } from "@/lib/cron-auth";
import { syncScryfall } from "@/lib/scryfall";
import { upsertTodaysCollectionSnapshot } from "@/db/queries/collection-value";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  try {
    const result = await syncScryfall({ source: "cron" });
    // Daily collection snapshot — runs after prices refresh so market value
    // reflects the new prices. Best-effort: never fails the cron over it.
    let snapshot: Awaited<
      ReturnType<typeof upsertTodaysCollectionSnapshot>
    > | null = null;
    try {
      snapshot = await upsertTodaysCollectionSnapshot();
    } catch (err) {
      console.error("[scryfall-sync] snapshot upsert failed:", err);
    }
    return Response.json({ ok: true, ...result, snapshot });
  } catch (err) {
    console.error("[scryfall-sync] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
