import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { scanCard } from "@/lib/ai/scan-card";

export const dynamic = "force-dynamic";
// Card scanning is well-bounded but the Anthropic call can take a few
// seconds on slow connections. 30s ceiling so we never get truncated by
// Vercel's default 10s function limit.
export const maxDuration = 30;

const bodySchema = z.object({
  // data URI prefix is stripped client-side so we only ship the base64
  // payload + the media type separately.
  imageBase64: z.string().min(64).max(8_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { imageBase64, mediaType } = parsed.data;

  try {
    const scan = await scanCard(imageBase64, mediaType);

    if (!scan.name) {
      return NextResponse.json({
        scan,
        match: null,
        candidates: [],
      });
    }

    // Resolve the identified name to a printing. Strategy:
    // 1. Exact case-insensitive match on cards.name.
    // 2. If setCode is also present, prefer the printing in that set.
    // 3. Otherwise return the newest non-promo printing as the default
    //    plus up to 5 other candidates for the user to choose from.
    const cardRows = (await db.execute(sql`
      SELECT oracle_id, name
      FROM cards
      WHERE lower(name) = lower(${scan.name})
      LIMIT 1
    `)) as unknown as Array<{ oracle_id: string; name: string }>;

    if (cardRows.length === 0) {
      // Fall back to trigram similarity — handles minor OCR errors like
      // "Lightning Bolts" vs "Lightning Bolt" or accented letters.
      const fuzzy = (await db.execute(sql`
        SELECT oracle_id, name
        FROM cards
        WHERE name % ${scan.name}
        ORDER BY similarity(name, ${scan.name}) DESC
        LIMIT 3
      `)) as unknown as Array<{ oracle_id: string; name: string }>;
      return NextResponse.json({
        scan,
        match: null,
        candidates: fuzzy.map((c) => ({
          oracleId: c.oracle_id,
          name: c.name,
        })),
      });
    }

    const oracleId = cardRows[0].oracle_id;
    const cardName = cardRows[0].name;

    // Pick a default printing — prefer the one matching the scanned set
    // code, then newest non-promo, then anything.
    const printingRows = (await db.execute(sql`
      SELECT id, set_code, set_name, collector_number, rarity,
             COALESCE(image_uris ->> 'small', card_faces -> 0 -> 'image_uris' ->> 'small') AS image_uri,
             usd, usd_foil,
             (promo_types IS NOT NULL AND array_length(promo_types, 1) IS NOT NULL) AS is_promo,
             released_at
      FROM printings
      WHERE oracle_id = ${oracleId}
      ORDER BY released_at DESC NULLS LAST, set_code
    `)) as unknown as Array<{
      id: string;
      set_code: string;
      set_name: string;
      collector_number: string;
      rarity: string | null;
      image_uri: string | null;
      usd: string | null;
      usd_foil: string | null;
      is_promo: boolean;
      released_at: string | null;
    }>;

    let defaultPrinting = printingRows[0];
    if (scan.setCode) {
      const setMatch = printingRows.find(
        (p) => p.set_code.toLowerCase() === scan.setCode!.toLowerCase(),
      );
      if (setMatch) defaultPrinting = setMatch;
    } else {
      // Prefer non-promo when no set hint is given.
      const nonPromo = printingRows.find((p) => !p.is_promo);
      if (nonPromo) defaultPrinting = nonPromo;
    }

    return NextResponse.json({
      scan,
      match: {
        oracleId,
        name: cardName,
        defaultPrintingId: defaultPrinting?.id ?? null,
        printings: printingRows.map((p) => ({
          id: p.id,
          setCode: p.set_code,
          setName: p.set_name,
          collectorNumber: p.collector_number,
          rarity: p.rarity,
          usd: p.usd,
          usdFoil: p.usd_foil,
          releasedAt: p.released_at,
        })),
      },
      candidates: [],
    });
  } catch (err) {
    console.error("[api/scan-card]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
