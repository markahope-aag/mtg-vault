import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> },
) {
  const { oracle_id } = await params;
  const printingId = req.nextUrl.searchParams.get("printingId");
  const days = Math.min(
    365,
    Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10) || 90),
  );

  try {
    let rows: Array<{ date: string; usd: string | null; usd_foil: string | null }> = [];
    if (printingId) {
      rows = (await db.execute(sql`
        SELECT date, usd::text AS usd, usd_foil::text AS usd_foil
        FROM price_history
        WHERE printing_id = ${printingId}
          AND date >= to_char(now() - (${days} || ' days')::interval, 'YYYY-MM-DD')
        ORDER BY date ASC
      `)) as unknown as typeof rows;
    } else {
      // No specific printing → pick the default-printing's history.
      rows = (await db.execute(sql`
        WITH default_p AS (
          SELECT id FROM printings
          WHERE oracle_id = ${oracle_id}
            AND (promo_types IS NULL OR array_length(promo_types, 1) IS NULL)
          ORDER BY released_at DESC NULLS LAST, set_code
          LIMIT 1
        )
        SELECT ph.date, ph.usd::text AS usd, ph.usd_foil::text AS usd_foil
        FROM price_history ph
        JOIN default_p p ON p.id = ph.printing_id
        WHERE ph.date >= to_char(now() - (${days} || ' days')::interval, 'YYYY-MM-DD')
        ORDER BY ph.date ASC
      `)) as unknown as typeof rows;
    }
    return NextResponse.json({
      points: rows.map((r) => ({
        date: r.date,
        usd: r.usd != null ? Number.parseFloat(r.usd) : null,
        usdFoil: r.usd_foil != null ? Number.parseFloat(r.usd_foil) : null,
      })),
    });
  } catch (err) {
    return serverError("api/cards/oracle_id/price-history", err, "Couldn't load price history.");
  }
}
