import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";

import { serverError } from "@/lib/api-errors";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> },
) {
  const { oracle_id } = await params;
  try {
    const cardRows = (await db.execute(sql`
      SELECT oracle_id, name, mana_cost, cmc, type_line, oracle_text,
             power, toughness, loyalty, color_identity, edhrec_rank,
             is_game_changer, is_mass_land_denial, is_extra_turn, is_tutor,
             is_reserved_list, is_commander_legal, legalities
      FROM cards WHERE oracle_id = ${oracle_id} LIMIT 1
    `)) as unknown as Array<Record<string, unknown>>;
    const card = cardRows[0];
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const printings = (await db.execute(sql`
      SELECT id, set_code, set_name, collector_number,
             COALESCE(image_uris ->> 'small', card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
             usd, usd_foil, rarity
      FROM printings
      WHERE oracle_id = ${oracle_id}
      ORDER BY released_at DESC NULLS LAST, set_code
      LIMIT 1000
    `)) as unknown as Array<{
      id: string;
      set_code: string;
      set_name: string;
      collector_number: string;
      image_uri: string | null;
      usd: string | null;
      usd_foil: string | null;
      rarity: string | null;
    }>;

    const ownership = (await db.execute(sql`
      SELECT i.printing_id, p.set_code, p.set_name,
             COUNT(*)::int AS count,
             array_remove(array_agg(DISTINCT i.location), NULL) AS locations
      FROM inventory i
      JOIN printings p ON p.id = i.printing_id
      WHERE p.oracle_id = ${oracle_id}
        AND i.disposed_at IS NULL
      GROUP BY i.printing_id, p.set_code, p.set_name
      ORDER BY count DESC
    `)) as unknown as Array<{
      printing_id: string;
      set_code: string;
      set_name: string;
      count: number;
      locations: string[];
    }>;

    const total = ownership.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({
      card: {
        oracleId: card.oracle_id,
        name: card.name,
        manaCost: card.mana_cost,
        cmc: card.cmc,
        typeLine: card.type_line,
        oracleText: card.oracle_text,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        colorIdentity: card.color_identity,
        edhrecRank: card.edhrec_rank,
        isGameChanger: card.is_game_changer,
        isMassLandDenial: card.is_mass_land_denial,
        isExtraTurn: card.is_extra_turn,
        isTutor: card.is_tutor,
        isReservedList: card.is_reserved_list,
        isCommanderLegal: card.is_commander_legal,
        legalities: card.legalities,
      },
      printings: printings.map((p) => ({
        id: p.id,
        setCode: p.set_code,
        setName: p.set_name,
        collectorNumber: p.collector_number,
        imageUri: p.image_uri,
        usd: p.usd,
        usdFoil: p.usd_foil,
        rarity: p.rarity,
      })),
      ownership: {
        total,
        byPrinting: ownership.map((o) => ({
          printingId: o.printing_id,
          setCode: o.set_code,
          setName: o.set_name,
          count: o.count,
          locations: o.locations ?? [],
        })),
      },
    });
  } catch (err) {
    return serverError("api/cards/oracle_id/detail", err, "Couldn't load that card.");
  }
}
