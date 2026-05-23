import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = (await db.execute(sql`
      SELECT DISTINCT location
      FROM inventory
      WHERE location IS NOT NULL AND location <> ''
      ORDER BY location ASC
    `)) as unknown as Array<{ location: string }>;
    return NextResponse.json({ locations: rows.map((r) => r.location) });
  } catch (err) {
    console.error("[api/inventory locations]", err);
    return NextResponse.json(
      { locations: [], error: "Couldn't load locations." },
      { status: 500 },
    );
  }
}
