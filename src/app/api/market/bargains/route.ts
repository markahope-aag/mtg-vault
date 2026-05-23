import { NextResponse } from "next/server";
import { sweepBargains } from "@/lib/market/bargain-sweep";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
// Bargain sweep iterates the want list × every enabled source; for a
// personal-scale want list this is sub-second, but each enabled source
// adds latency proportional to its rate-limit budget. 60s ceiling.
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await sweepBargains({ wantLimit: 50, perWantLimit: 15 });
    return NextResponse.json(result);
  } catch (err) {
    return serverError(
      "api/market/bargains",
      err,
      "Bargain sweep failed.",
    );
  }
}
