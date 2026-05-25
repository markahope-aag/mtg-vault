import { NextResponse } from "next/server";
import { sweepBargains } from "@/lib/market/bargain-sweep";
import { rateLimit } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
// Bargain sweep iterates the want list × every enabled source; for a
// personal-scale want list this is sub-second, but each enabled source
// adds latency proportional to its rate-limit budget. 60s ceiling.
export const maxDuration = 60;

export async function POST() {
  // Cost guard. A bargain sweep fans out across every enabled source
  // (eBay Browse API + each configured Shopify scraper), each with
  // its own rate-limit budget + outbound traffic. A runaway UI loop
  // or programmatic hammer could chew through the scrapers' per-day
  // token-bucket budgets AND any paid Bright Data Web Unlocker
  // credits. 20/min is comfortably above any realistic human-paced
  // workflow (each sweep takes 10-60s) but trips fast on a loop.
  const limit = rateLimit("market-bargains", 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sweeps this minute. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

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
