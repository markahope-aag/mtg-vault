import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { inventory, locations } from "@/db/schema";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // Look up the location's name so we can clear it from inventory rows
    // before deleting. We do both inside a single transaction so a partial
    // failure can't leave orphan values.
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ name: locations.name })
        .from(locations)
        .where(eq(locations.id, id))
        .limit(1);
      if (!row) return null;

      const cleared = await tx
        .update(inventory)
        .set({ location: null, updatedAt: sql`now()` })
        .where(eq(inventory.location, row.name))
        .returning({ id: inventory.id });

      await tx.delete(locations).where(eq(locations.id, id));
      return { cleared: cleared.length };
    });

    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, cleared: result.cleared });
  } catch (err) {
    return serverError("api/locations/id", err, "Couldn't update that location.");
  }
}
