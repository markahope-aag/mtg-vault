import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

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
    console.error("[api/inventory dispose-targets]", err);
    return NextResponse.json({ targets: [] }, { status: 500 });
  }
}
