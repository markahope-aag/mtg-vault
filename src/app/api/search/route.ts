import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { detectScryfallSyntax } from "@/lib/scryfall-operators";
import { sqlArray } from "@/lib/sql";

export const dynamic = "force-dynamic";

const SCRYFALL_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  Accept: "application/json",
};
const SCRYFALL_DELAY_MS = 100;
const MAX_LIMIT = 50;

export type SearchResult = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  colorIdentity: string[] | null;
  edhrecRank: number | null;
  defaultPrintingId: string | null;
  imageUri: string | null;
};

type LocalRow = {
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string | null;
  color_identity: string[] | null;
  edhrec_rank: number | null;
  default_printing_id: string | null;
  image_uri: string | null;
};

type ScryfallRow = {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  color_identity?: string[];
  edhrec_rank?: number | null;
  image_uris?: Record<string, string>;
  card_faces?: Array<{ image_uris?: Record<string, string> }>;
};

function pickScryfallImage(card: ScryfallRow): string | null {
  if (card.image_uris?.small) return card.image_uris.small;
  const face = card.card_faces?.find((f) => f.image_uris?.small);
  return face?.image_uris?.small ?? null;
}

async function searchLocal(
  q: string,
  limit: number,
  commanderOnly: boolean,
  ownedOnly: boolean,
  colorIdentity: string[] | null,
  types: string[] | null,
): Promise<SearchResult[]> {
  const commanderClause = commanderOnly
    ? sql`AND (
        c.type_line ILIKE '%Legendary Creature%'
        OR c.oracle_text ILIKE '%can be your commander%'
      )`
    : sql``;
  const ownedClause = ownedOnly
    ? sql`AND EXISTS (
        SELECT 1 FROM oracle_ownership o
        WHERE o.oracle_id = c.oracle_id AND o.owned_count > 0
      )`
    : sql``;
  const colorClause =
    colorIdentity && colorIdentity.length > 0
      ? sql`AND c.color_identity <@ ${sqlArray(colorIdentity, "text")}`
      : sql``;
  const typeClause =
    types && types.length > 0
      ? sql`AND EXISTS (
          SELECT 1 FROM UNNEST(${sqlArray(types, "text")}) AS t
          WHERE c.type_line ILIKE '%' || t || '%'
        )`
      : sql``;
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id,
      c.name,
      c.mana_cost,
      c.type_line,
      c.color_identity,
      c.edhrec_rank,
      p.id AS default_printing_id,
      (p.image_uris ->> 'small') AS image_uri
    FROM cards c
    LEFT JOIN LATERAL (
      SELECT id, image_uris
      FROM printings
      WHERE oracle_id = c.oracle_id
        AND (promo_types IS NULL OR array_length(promo_types, 1) IS NULL)
      ORDER BY released_at DESC NULLS LAST, set_code, collector_number
      LIMIT 1
    ) p ON TRUE
    WHERE (c.name % ${q} OR c.name ILIKE ${q + "%"})
      ${commanderClause}
      ${ownedClause}
      ${colorClause}
      ${typeClause}
    ORDER BY
      (c.name ILIKE ${q + "%"}) DESC,
      similarity(c.name, ${q}) DESC,
      c.edhrec_rank ASC NULLS LAST
    LIMIT ${limit};
  `)) as unknown as LocalRow[];

  return rows.map((r) => ({
    oracleId: r.oracle_id,
    name: r.name,
    manaCost: r.mana_cost,
    typeLine: r.type_line,
    colorIdentity: r.color_identity,
    edhrecRank: r.edhrec_rank,
    defaultPrintingId: r.default_printing_id,
    imageUri: r.image_uri,
  }));
}

async function searchScryfall(
  q: string,
  limit: number,
): Promise<SearchResult[]> {
  const url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", q);
  url.searchParams.set("unique", "cards");
  url.searchParams.set("order", "name");

  // Single page is plenty for the palette.
  await new Promise((r) => setTimeout(r, SCRYFALL_DELAY_MS));
  const res = await fetch(url.toString(), { headers: SCRYFALL_HEADERS });
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`Scryfall ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { data: ScryfallRow[] };
  return data.data.slice(0, limit).map((card) => ({
    oracleId: card.oracle_id ?? card.id,
    name: card.name,
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line ?? null,
    colorIdentity: card.color_identity ?? null,
    edhrecRank: card.edhrec_rank ?? null,
    defaultPrintingId: card.id,
    imageUri: pickScryfallImage(card),
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1),
    MAX_LIMIT,
  );

  if (q.length === 0) {
    return NextResponse.json({ results: [], source: "local" as const });
  }

  const commanderOnly = searchParams.get("commanderOnly") === "true";
  const ownedOnly = searchParams.get("filter[ownedOnly]") === "true";
  const colorRaw = searchParams.get("filter[colorIdentity]");
  const colorIdentity = colorRaw ? colorRaw.split(",").filter(Boolean) : null;
  const typeRaw = searchParams.get("filter[types]");
  const types = typeRaw ? typeRaw.split(",").filter(Boolean) : null;
  // Force local mode when any local-only filter is requested.
  const useLocalFilters =
    commanderOnly || ownedOnly || colorIdentity != null || types != null;
  const useScryfall = !useLocalFilters && detectScryfallSyntax(q);
  try {
    const results = useScryfall
      ? await searchScryfall(q, limit)
      : await searchLocal(
          q,
          limit,
          commanderOnly,
          ownedOnly,
          colorIdentity,
          types,
        );
    return NextResponse.json({
      results,
      source: useScryfall ? ("scryfall" as const) : ("local" as const),
    });
  } catch (err) {
    console.error("[api/search] failed:", err);
    return NextResponse.json(
      {
        results: [],
        source: "local" as const,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
