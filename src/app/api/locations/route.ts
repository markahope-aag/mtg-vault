import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { locations } from "@/db/schema";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  // Include a usage count so the management UI can warn the user how many
  // inventory rows will be affected if they delete the location.
  const rows = (await db.execute(sql`
    SELECT l.id, l.name,
           COUNT(i.id) FILTER (WHERE i.disposed_at IS NULL)::int AS used_by
    FROM locations l
    LEFT JOIN inventory i ON i.location = l.name
    GROUP BY l.id, l.name
    ORDER BY l.name ASC
  `)) as unknown as Array<{ id: string; name: string; used_by: number }>;
  return NextResponse.json({
    locations: rows.map((r) => ({ id: r.id, name: r.name, usedBy: r.used_by })),
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const [created] = await db
      .insert(locations)
      .values({ name: parsed.data.name })
      .onConflictDoNothing()
      .returning({ id: locations.id, name: locations.name });
    if (!created) {
      return NextResponse.json(
        { error: "A location with that name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ location: created }, { status: 201 });
  } catch (err) {
    console.error("[api/locations POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
