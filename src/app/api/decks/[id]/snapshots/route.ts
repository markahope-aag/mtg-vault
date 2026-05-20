import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckSnapshots } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await db
      .select()
      .from(deckSnapshots)
      .where(eq(deckSnapshots.deckId, id))
      .orderBy(desc(deckSnapshots.snapshotAt))
      .limit(50);
    return NextResponse.json({
      snapshots: rows.map((r) => ({
        id: r.id,
        snapshotAt: r.snapshotAt.toISOString(),
        totalValueUsd: r.totalValueUsd,
        calculatedBracket: r.calculatedBracket,
        bracketReasons: r.bracketReasons,
      })),
    });
  } catch (err) {
    console.error("[api/decks snapshots GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
