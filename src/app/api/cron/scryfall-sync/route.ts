import { checkCronAuth } from "@/lib/cron-auth";
import { syncScryfall } from "@/lib/scryfall";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  try {
    const result = await syncScryfall({ source: "cron" });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[scryfall-sync] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
