import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { refreshAllBracketFlags } from "@/lib/bracket-flags";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;
  try {
    const summary = await refreshAllBracketFlags();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/refresh-bracket-flags]", err);
    return NextResponse.json(
      { ok: false, error: "Refresh failed; see server logs." },
      { status: 500 },
    );
  }
}

// Allow POST from the admin page's server action — same logic, same guard.
export const POST = GET;
