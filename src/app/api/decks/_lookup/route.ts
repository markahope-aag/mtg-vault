import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

// Internal helper for the new-deck dialog: given a printing id, return the
// card's oracle text and color identity so the dialog can decide whether to
// show the partner toggle. Not used outside the deck flow.
export async function GET(req: NextRequest) {
  const printingId = req.nextUrl.searchParams.get("printingId");
  if (!printingId) {
    return NextResponse.json({ error: "Missing printingId" }, { status: 400 });
  }
  const rows = (await db.execute(sql`
    SELECT c.oracle_text, c.color_identity, c.type_line, c.name
    FROM printings p
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE p.id = ${printingId}
    LIMIT 1
  `)) as unknown as Array<{
    oracle_text: string | null;
    color_identity: string[] | null;
    type_line: string | null;
    name: string;
  }>;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    oracleText: rows[0].oracle_text,
    colorIdentity: rows[0].color_identity,
    typeLine: rows[0].type_line,
    name: rows[0].name,
  });
}
