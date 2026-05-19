import { checkCronAuth } from "@/lib/cron-auth";
import { syncGameChangers } from "@/lib/game-changers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  try {
    const result = await syncGameChangers();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[game-changers-sync] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
