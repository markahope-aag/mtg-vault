import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { trades } from "@/db/schema";

export const dynamic = "force-dynamic";

// Full trade detail: header + the inventory rows on both sides of the
// trade. Used by /trades/[id] to render the ledger view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const tradeRows = await db
      .select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);
    const trade = tradeRows[0];
    if (!trade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const items = (await db.execute(sql`
      SELECT
        i.id, i.foil, i.etched, i.condition,
        i.disposed_at, i.disposed_price, i.disposed_to,
        i.acquired_price, i.purchased_from, i.location,
        c.oracle_id, c.name, c.mana_cost, c.type_line,
        p.set_code, p.set_name, p.collector_number,
        COALESCE(p.image_uris ->> 'small', p.card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      JOIN cards c ON c.oracle_id = p.oracle_id
      WHERE i.trade_id = ${id}
      ORDER BY (i.disposed_at IS NOT NULL) DESC, c.name ASC
    `)) as unknown as Array<{
      id: string;
      foil: boolean;
      etched: boolean;
      condition: string;
      disposed_at: string | null;
      disposed_price: string | null;
      disposed_to: string | null;
      acquired_price: string | null;
      purchased_from: string | null;
      location: string | null;
      oracle_id: string;
      name: string;
      mana_cost: string | null;
      type_line: string | null;
      set_code: string;
      set_name: string;
      collector_number: string;
      image_uri: string | null;
    }>;

    return NextResponse.json({
      trade: {
        id: trade.id,
        partner: trade.partner,
        tradedAt: trade.tradedAt.toISOString(),
        notes: trade.notes,
      },
      out: items
        .filter((i) => i.disposed_at != null)
        .map((i) => ({
          inventoryId: i.id,
          oracleId: i.oracle_id,
          name: i.name,
          manaCost: i.mana_cost,
          typeLine: i.type_line,
          setCode: i.set_code,
          setName: i.set_name,
          collectorNumber: i.collector_number,
          imageUri: i.image_uri,
          foil: i.foil,
          etched: i.etched,
          condition: i.condition,
          value:
            i.disposed_price != null ? Number.parseFloat(i.disposed_price) : 0,
        })),
      in: items
        .filter((i) => i.disposed_at == null)
        .map((i) => ({
          inventoryId: i.id,
          oracleId: i.oracle_id,
          name: i.name,
          manaCost: i.mana_cost,
          typeLine: i.type_line,
          setCode: i.set_code,
          setName: i.set_name,
          collectorNumber: i.collector_number,
          imageUri: i.image_uri,
          foil: i.foil,
          etched: i.etched,
          condition: i.condition,
          value:
            i.acquired_price != null ? Number.parseFloat(i.acquired_price) : 0,
          location: i.location,
        })),
    });
  } catch (err) {
    console.error("[api/trades/[id] GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
