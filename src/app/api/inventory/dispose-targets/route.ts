import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = (await db.execute(sql`
      SELECT DISTINCT disposed_to
      FROM inventory
      WHERE disposed_to IS NOT NULL AND disposed_to <> ''
      ORDER BY disposed_to ASC
    `)) as unknown as Array<{ disposed_to: string }>;
    return NextResponse.json({ targets: rows.map((r) => r.disposed_to) });
  } catch (err) {
    // Used to return `{ targets: [] }` with status 500 — which made any
    // caller that didn't check `res.ok` render "no dispose targets"
    // instead of surfacing the error. Match the standard
    // serverError shape so failures look like failures.
    return serverError(
      "api/inventory dispose-targets",
      err,
      "Couldn't load dispose targets.",
    );
  }
}
