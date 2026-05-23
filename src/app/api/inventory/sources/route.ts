import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = (await db.execute(sql`
      SELECT DISTINCT purchased_from
      FROM inventory
      WHERE purchased_from IS NOT NULL AND purchased_from <> ''
      ORDER BY purchased_from ASC
    `)) as unknown as Array<{ purchased_from: string }>;
    return NextResponse.json({ sources: rows.map((r) => r.purchased_from) });
  } catch (err) {
    console.error("[api/inventory sources]", err);
    return NextResponse.json(
      { sources: [], error: "Couldn't load purchase sources." },
      { status: 500 },
    );
  }
}
