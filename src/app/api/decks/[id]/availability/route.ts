import { NextResponse, type NextRequest } from "next/server";
import { getAvailability } from "@/db/queries/availability";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { oracleIds?: unknown }).oracleIds)
  ) {
    return NextResponse.json(
      { error: "Body must be { oracleIds: string[] }" },
      { status: 400 },
    );
  }
  const oracleIds = ((body as { oracleIds: string[] }).oracleIds ?? []).filter(
    (v): v is string => typeof v === "string",
  );

  try {
    const availability = await getAvailability(oracleIds, id);
    return NextResponse.json({ availability });
  } catch (err) {
    return serverError("api/decks/id/availability", err, "Couldn't compute availability.");
  }
}
