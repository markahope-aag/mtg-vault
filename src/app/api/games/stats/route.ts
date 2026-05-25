import { NextResponse, type NextRequest } from "next/server";
import {
  bracketRealityFlags,
  deckMatchups,
  deckStats,
} from "@/lib/games/queries";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deckId = url.searchParams.get("deckId");

  try {
    if (deckId) {
      const [stats, matchups] = await Promise.all([
        deckStats(deckId),
        deckMatchups(deckId),
      ]);
      if (!stats) {
        return NextResponse.json({ error: "Deck not found" }, { status: 404 });
      }
      return NextResponse.json({ stats, matchups });
    }
    // No deckId — return the global bracket-reality dashboard.
    const flags = await bracketRealityFlags();
    return NextResponse.json({ bracketRealityFlags: flags });
  } catch (err) {
    return serverError("api/games/stats GET", err, "Failed to load stats.");
  }
}
