import { NextResponse } from "next/server";
import { upsertTodaysCollectionSnapshot } from "@/db/queries/collection-value";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await upsertTodaysCollectionSnapshot();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/collection/snapshot]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
