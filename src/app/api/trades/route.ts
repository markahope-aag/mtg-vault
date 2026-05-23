import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { inventory, trades } from "@/db/schema";

export const dynamic = "force-dynamic";

// Trade body. "out" rows reference existing inventory ids the user is giving
// away; "in" rows reference printings the user is receiving (one row per
// physical card, mirroring the AddCardsDialog shape).
const tradeSchema = z.object({
  partner: z.string().trim().min(1).max(200),
  tradedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  out: z
    .array(
      z.object({
        inventoryId: z.string().uuid(),
        value: z.number().nonnegative().optional().nullable(),
      }),
    )
    .max(500),
  in: z
    .array(
      z.object({
        printingId: z.string().uuid(),
        foil: z.boolean().default(false),
        etched: z.boolean().default(false),
        condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).default("NM"),
        language: z.string().default("en"),
        location: z.string().trim().max(200).optional().nullable(),
        value: z.number().nonnegative().optional().nullable(),
      }),
    )
    .max(500),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.out.length === 0 && data.in.length === 0) {
    return NextResponse.json(
      { error: "A trade must include at least one card going out or coming in." },
      { status: 400 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [trade] = await tx
        .insert(trades)
        .values({
          partner: data.partner,
          tradedAt: data.tradedAt ? new Date(data.tradedAt) : new Date(),
          notes: data.notes ?? null,
        })
        .returning();

      const tradeLabel = `Trade: ${data.partner}`;

      // Mark outgoing inventory rows disposed. Tagging them with trade_id
      // lets us reconstruct the full event later.
      for (const outRow of data.out) {
        await tx
          .update(inventory)
          .set({
            disposedAt: data.tradedAt ? new Date(data.tradedAt) : sql`now()`,
            disposedTo: tradeLabel,
            disposedPrice:
              outRow.value != null ? outRow.value.toFixed(2) : null,
            tradeId: trade.id,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(inventory.id, outRow.inventoryId),
              // Don't double-dispose a row that's already gone.
              isNull(inventory.disposedAt),
            ),
          );
      }

      // Create new inventory rows for incoming cards.
      if (data.in.length > 0) {
        await tx.insert(inventory).values(
          data.in.map((row) => ({
            printingId: row.printingId,
            foil: row.foil,
            etched: row.etched,
            condition: row.condition,
            language: row.language,
            location: row.location ?? null,
            acquiredPrice: row.value != null ? row.value.toFixed(2) : null,
            acquiredAt: data.tradedAt ? new Date(data.tradedAt) : new Date(),
            purchasedFrom: tradeLabel,
            tradeId: trade.id,
          })),
        );
      }

      return trade;
    });

    return NextResponse.json({ trade: result }, { status: 201 });
  } catch (err) {
    console.error("[api/trades POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Summary per trade: counts + total values both directions.
    const rows = (await db.execute(sql`
      SELECT
        t.id, t.partner, t.traded_at, t.notes, t.created_at,
        COALESCE(out_summary.cnt, 0)::int AS out_count,
        COALESCE(out_summary.total, 0)::numeric(12,2) AS out_value,
        COALESCE(in_summary.cnt, 0)::int AS in_count,
        COALESCE(in_summary.total, 0)::numeric(12,2) AS in_value
      FROM trades t
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt, COALESCE(SUM(disposed_price::numeric), 0) AS total
        FROM inventory i
        WHERE i.trade_id = t.id AND i.disposed_at IS NOT NULL
      ) out_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt, COALESCE(SUM(acquired_price::numeric), 0) AS total
        FROM inventory i
        WHERE i.trade_id = t.id AND i.disposed_at IS NULL
      ) in_summary ON TRUE
      ORDER BY t.traded_at DESC, t.created_at DESC
      LIMIT 200
    `)) as unknown as Array<{
      id: string;
      partner: string;
      traded_at: string;
      notes: string | null;
      created_at: string;
      out_count: number;
      out_value: string;
      in_count: number;
      in_value: string;
    }>;
    return NextResponse.json({
      trades: rows.map((r) => ({
        id: r.id,
        partner: r.partner,
        tradedAt: new Date(r.traded_at).toISOString(),
        notes: r.notes,
        outCount: r.out_count,
        outValue: Number.parseFloat(r.out_value) || 0,
        inCount: r.in_count,
        inValue: Number.parseFloat(r.in_value) || 0,
      })),
    });
  } catch (err) {
    console.error("[api/trades GET]", err);
    return NextResponse.json(
      {
        trades: [],
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// Silence lint: drizzle imports we don't end up using in the surface above
// but want available if/when we add detail endpoints.
void desc;
void isNotNull;
