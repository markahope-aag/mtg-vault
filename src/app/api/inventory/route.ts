import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { inventory } from "@/db/schema";
import { createInventoryBodySchema } from "@/lib/inventory/schemas";
import { listInventory, type ListFilters } from "@/lib/inventory/queries";

export const dynamic = "force-dynamic";

const SORT_KEYS = new Set([
  "name",
  "cmc",
  "usd",
  "acquiredAt",
  "condition",
  "location",
  "createdAt",
]);

function readFilter(params: URLSearchParams, key: string): string | undefined {
  return params.get(`filter[${key}]`) ?? undefined;
}

function readBoolFilter(params: URLSearchParams, key: string): boolean {
  const v = readFilter(params, key);
  return v === "true" || v === "1";
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const limitRaw = Number.parseInt(params.get("limit") ?? "50", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1),
    200,
  );
  const cursorRaw = params.get("cursor");
  const offset = cursorRaw ? Math.max(Number.parseInt(cursorRaw, 10) || 0, 0) : 0;

  const sortRaw = params.get("sort") ?? "createdAt";
  const sort = (SORT_KEYS.has(sortRaw) ? sortRaw : "createdAt") as
    | "name"
    | "cmc"
    | "usd"
    | "acquiredAt"
    | "condition"
    | "location"
    | "createdAt";
  const direction = params.get("dir") === "asc" ? "asc" : "desc";

  const colorsRaw = readFilter(params, "colors");
  const filters: ListFilters = {
    name: readFilter(params, "name"),
    colors: colorsRaw ? colorsRaw.split(",").filter(Boolean) : undefined,
    type: readFilter(params, "type"),
    set: readFilter(params, "set"),
    ownedOnly: readBoolFilter(params, "ownedOnly"),
    foilOnly: readBoolFilter(params, "foilOnly"),
    bannedOnly: readBoolFilter(params, "bannedOnly"),
    location: readFilter(params, "location"),
    importBatchId: readFilter(params, "importBatchId"),
    includeDisposed: readBoolFilter(params, "includeDisposed"),
  };

  try {
    const result = await listInventory({
      filters,
      sort,
      direction,
      offset,
      limit,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/inventory GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createInventoryBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const inserted = await db
      .insert(inventory)
      .values(
        parsed.data.rows.map((r) => ({
          printingId: r.printingId,
          foil: r.foil ?? false,
          etched: r.etched ?? false,
          condition: r.condition ?? "NM",
          language: r.language ?? "en",
          location: r.location ?? null,
          physicalId: r.physicalId ?? null,
          acquiredPrice: r.acquiredPrice ?? null,
          acquiredAt: r.acquiredAt ?? null,
          purchasedFrom: r.purchasedFrom ?? null,
          gradingCompany: r.gradingCompany ?? null,
          grade: r.grade ?? null,
          notes: r.notes ?? null,
        })),
      )
      .returning();
    return NextResponse.json({ rows: inserted }, { status: 201 });
  } catch (err) {
    console.error("[api/inventory POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
