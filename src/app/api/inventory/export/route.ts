import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

// CSV export in Moxfield-compatible format so the file can be re-imported
// via the Phase 5 importer round-trip. Headers chosen to match the Moxfield
// detector in src/lib/importers/detect.ts.

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  try {
    const rows = (await db.execute(sql`
      SELECT
        c.name,
        p.set_code,
        p.collector_number,
        i.condition,
        i.language,
        i.foil,
        i.etched,
        i.acquired_price::text AS acquired_price,
        TO_CHAR(i.acquired_at, 'YYYY-MM-DD') AS acquired_at,
        i.purchased_from,
        i.location,
        i.physical_id,
        i.grading_company,
        i.grade,
        i.notes
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.disposed_at IS NULL
      ORDER BY c.name ASC, p.set_code ASC
    `)) as unknown as Array<{
      name: string;
      set_code: string;
      collector_number: string;
      condition: string;
      language: string;
      foil: boolean;
      etched: boolean;
      acquired_price: string | null;
      acquired_at: string | null;
      purchased_from: string | null;
      location: string | null;
      physical_id: string | null;
      grading_company: string | null;
      grade: string | null;
      notes: string | null;
    }>;

    const headers = [
      "Count",
      "Tradelist Count",
      "Name",
      "Edition",
      "Condition",
      "Language",
      "Foil",
      "Collector Number",
      "Etched",
      "Purchase Price",
      "Last Modified",
      "Purchased From",
      "Location",
      "Physical ID",
      "Grading Company",
      "Grade",
      "Notes",
    ];

    const lines: string[] = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          1,
          0,
          csvEscape(r.name),
          csvEscape(r.set_code),
          csvEscape(r.condition),
          csvEscape(r.language),
          r.foil ? 1 : 0,
          csvEscape(r.collector_number),
          r.etched ? 1 : 0,
          r.acquired_price ?? "",
          r.acquired_at ?? "",
          csvEscape(r.purchased_from),
          csvEscape(r.location),
          csvEscape(r.physical_id),
          csvEscape(r.grading_company),
          csvEscape(r.grade),
          csvEscape(r.notes),
        ].join(","),
      );
    }
    const body = lines.join("\r\n");
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mtg-vault-collection-${date}.csv"`,
      },
    });
  } catch (err) {
    return serverError("api/inventory/export", err, "Export failed.");
  }
}
