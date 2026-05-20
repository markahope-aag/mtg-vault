import { NextResponse, type NextRequest } from "next/server";
import {
  estimateBracket,
  SpellbookUnavailableError,
} from "@/lib/spellbook";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const oracleCsv = req.nextUrl.searchParams.get("oracleIds") ?? "";
  const commanderCsv = req.nextUrl.searchParams.get("commanderIds") ?? "";
  const mainOracleIds = oracleCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const commanderOracleIds = commanderCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const result = await estimateBracket({
      commanderOracleIds,
      mainOracleIds,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SpellbookUnavailableError) {
      return NextResponse.json(
        { ok: false, unavailable: true, error: err.message },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
