import { asc } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { locations } from "@/db/schema";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  const rows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .orderBy(asc(locations.name));
  return NextResponse.json({ locations: rows });
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
      // Already exists — return the existing row instead of 409.
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
