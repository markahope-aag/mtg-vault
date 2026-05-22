import { checkCronAuth } from "@/lib/cron-auth";
import { upsertTodaysCollectionSnapshot } from "@/db/queries/collection-value";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily collection-value snapshot.
 *
 * The heavy Scryfall bulk card/price sync used to run here too, but a ~500MB
 * bulk file cannot reliably stream + upsert within a serverless timeout — it
 * always failed. That full refresh now runs in the weekly GitHub Action
 * (.github/workflows/weekly-card-sync.yml). This cron keeps only the
 * lightweight daily snapshot, so it completes well within its budget.
 */
export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  try {
    const snapshot = await upsertTodaysCollectionSnapshot();
    return Response.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[daily-snapshot] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
