import { NextResponse } from "next/server";
import { upsertTodaysCollectionSnapshot } from "@/db/queries/collection-value";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await upsertTodaysCollectionSnapshot();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return serverError("api/collection/snapshot", err, "Snapshot failed.");
  }
}

export const GET = POST;
