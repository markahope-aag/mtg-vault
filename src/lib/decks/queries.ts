import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { toIso } from "@/lib/utils";
import { sqlArray } from "@/lib/sql";

export type DeckListRow = {
  id: string;
  name: string;
  commanderPrintingId: string | null;
  partnerPrintingId: string | null;
  targetBracket: number | null;
  archetype: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  commanderName: string | null;
  commanderImageUri: string | null;
  partnerName: string | null;
  colorIdentity: string[] | null;
  totalCards: number;
  totalValueUsd: number;
};

export async function listDecks(opts: {
  sort: "name" | "updatedAt" | "createdAt";
  direction: "asc" | "desc";
  filters: { archetype?: string; isPrimary?: boolean; colorIdentity?: string[] };
}): Promise<DeckListRow[]> {
  const { sort, direction, filters } = opts;
  const dir = direction === "asc" ? sql`ASC` : sql`DESC`;
  const sortCol =
    sort === "name"
      ? sql`d.name`
      : sort === "createdAt"
        ? sql`d.created_at`
        : sql`d.updated_at`;

  const clauses: ReturnType<typeof sql>[] = [];
  if (filters.archetype) {
    clauses.push(sql`d.archetype ILIKE ${"%" + filters.archetype + "%"}`);
  }
  if (filters.isPrimary != null) {
    clauses.push(sql`d.is_primary = ${filters.isPrimary}`);
  }
  if (filters.colorIdentity && filters.colorIdentity.length > 0) {
    clauses.push(
      sql`cmd.color_identity && ${sqlArray(filters.colorIdentity, "text")}`,
    );
  }
  const where = clauses.length
    ? clauses.reduce((a, c, i) => (i === 0 ? c : sql`${a} AND ${c}`))
    : sql`TRUE`;

  const rows = (await db.execute(sql`
    SELECT
      d.id, d.name, d.commander_printing_id, d.partner_printing_id,
      d.target_bracket, d.archetype, d.notes, d.is_primary,
      d.created_at, d.updated_at,
      cmd.name AS commander_name,
      COALESCE(cmd_p.image_uris ->> 'normal', cmd_p.card_faces -> 0 -> 'image_uris' ->> 'normal') AS commander_image_uri,
      cmd.color_identity,
      partner.name AS partner_name,
      COALESCE(stats.total_cards, 0)::int AS total_cards,
      COALESCE(stats.total_value, 0)::numeric(14,2) AS total_value
    FROM decks d
    LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
    LEFT JOIN cards cmd ON cmd.oracle_id = cmd_p.oracle_id
    LEFT JOIN printings partner_p ON partner_p.id = d.partner_printing_id
    LEFT JOIN cards partner ON partner.oracle_id = partner_p.oracle_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(dc.quantity), 0)
          + CASE WHEN d.commander_printing_id IS NULL THEN 0 ELSE 1 END
          + CASE WHEN d.partner_printing_id   IS NULL THEN 0 ELSE 1 END
          AS total_cards,
        COALESCE(SUM(dc.quantity * COALESCE(p.usd::numeric, 0)), 0)
          + COALESCE(cmd_p.usd::numeric, 0)
          + COALESCE(partner_p.usd::numeric, 0)
          AS total_value
      FROM deck_cards dc
      JOIN printings p ON p.id = dc.printing_id
      WHERE dc.deck_id = d.id
    ) stats ON TRUE
    WHERE ${where}
    ORDER BY ${sortCol} ${dir} NULLS LAST, d.id ASC
  `)) as unknown as Array<{
    id: string;
    name: string;
    commander_printing_id: string | null;
    partner_printing_id: string | null;
    target_bracket: number | null;
    archetype: string | null;
    notes: string | null;
    is_primary: boolean;
    created_at: Date;
    updated_at: Date;
    commander_name: string | null;
    commander_image_uri: string | null;
    color_identity: string[] | null;
    partner_name: string | null;
    total_cards: number;
    total_value: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    commanderPrintingId: r.commander_printing_id,
    partnerPrintingId: r.partner_printing_id,
    targetBracket: r.target_bracket,
    archetype: r.archetype,
    notes: r.notes,
    isPrimary: r.is_primary,
    createdAt: toIso(r.created_at) ?? "",
    updatedAt: toIso(r.updated_at) ?? "",
    commanderName: r.commander_name,
    commanderImageUri: r.commander_image_uri,
    partnerName: r.partner_name,
    colorIdentity: r.color_identity,
    totalCards: r.total_cards,
    totalValueUsd: Number.parseFloat(String(r.total_value)) || 0,
  }));
}

export async function fetchDeckDetail(deckId: string) {
  const deckRows = (await db.execute(sql`
    SELECT
      d.*,
      cmd.oracle_id AS cmd_oracle_id, cmd.name AS cmd_name,
      cmd.mana_cost AS cmd_mana_cost, cmd.cmc AS cmd_cmc,
      cmd.type_line AS cmd_type_line, cmd.oracle_text AS cmd_oracle_text,
      cmd.colors AS cmd_colors, cmd.color_identity AS cmd_color_identity,
      cmd.keywords AS cmd_keywords,
      cmd_p.id AS cmd_printing_id, cmd_p.set_code AS cmd_set_code,
      cmd_p.set_name AS cmd_set_name, cmd_p.collector_number AS cmd_collector_number,
      cmd_p.image_uris AS cmd_image_uris,
      cmd_p.card_faces AS cmd_card_faces,
      cmd_p.usd AS cmd_usd, cmd_p.usd_foil AS cmd_usd_foil,
      pa.oracle_id AS pa_oracle_id, pa.name AS pa_name,
      pa.mana_cost AS pa_mana_cost, pa.cmc AS pa_cmc,
      pa.type_line AS pa_type_line, pa.oracle_text AS pa_oracle_text,
      pa.colors AS pa_colors, pa.color_identity AS pa_color_identity,
      pa.keywords AS pa_keywords,
      pa_p.id AS pa_printing_id, pa_p.set_code AS pa_set_code,
      pa_p.set_name AS pa_set_name, pa_p.collector_number AS pa_collector_number,
      pa_p.image_uris AS pa_image_uris,
      pa_p.card_faces AS pa_card_faces,
      pa_p.usd AS pa_usd, pa_p.usd_foil AS pa_usd_foil
    FROM decks d
    LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
    LEFT JOIN cards cmd ON cmd.oracle_id = cmd_p.oracle_id
    LEFT JOIN printings pa_p ON pa_p.id = d.partner_printing_id
    LEFT JOIN cards pa ON pa.oracle_id = pa_p.oracle_id
    WHERE d.id = ${deckId}
    LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  const d = deckRows[0];
  if (!d) return null;

  const cardRows = (await db.execute(sql`
    SELECT
      dc.printing_id, dc.quantity, dc.category,
      c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.oracle_text,
      c.colors, c.color_identity, c.keywords,
      p.set_code, p.set_name, p.collector_number, p.image_uris, p.card_faces,
      p.usd, p.usd_foil,
      (
        SELECT count(*)::int FROM inventory i
        WHERE i.printing_id = dc.printing_id
          AND i.disposed_at IS NULL
      ) AS owned_count,
      (
        SELECT count(*)::int FROM inventory i
        JOIN printings ip ON ip.id = i.printing_id
        WHERE ip.oracle_id = c.oracle_id
          AND i.disposed_at IS NULL
      ) AS owned_any_printing
    FROM deck_cards dc
    JOIN printings p ON p.id = dc.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE dc.deck_id = ${deckId}
    ORDER BY c.name ASC, dc.category ASC
  `)) as unknown as Array<{
    printing_id: string;
    quantity: number;
    category: string;
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    cmc: string | null;
    type_line: string | null;
    oracle_text: string | null;
    colors: string[] | null;
    color_identity: string[] | null;
    keywords: string[] | null;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_uris: Record<string, string> | null;
    card_faces: Array<{ image_uris?: Record<string, string> | null }> | null;
    usd: string | null;
    usd_foil: string | null;
    owned_count: number;
    owned_any_printing: number;
  }>;

  const cards = cardRows.map((r) => ({
    deckCardRow: {
      printingId: r.printing_id,
      quantity: r.quantity,
      category: r.category,
    },
    card: {
      oracleId: r.oracle_id,
      name: r.name,
      manaCost: r.mana_cost,
      cmc: r.cmc,
      typeLine: r.type_line,
      oracleText: r.oracle_text,
      colors: r.colors,
      colorIdentity: r.color_identity,
      keywords: r.keywords,
    },
    printing: {
      id: r.printing_id,
      setCode: r.set_code,
      setName: r.set_name,
      collectorNumber: r.collector_number,
      imageUris: r.image_uris,
      cardFaces: r.card_faces,
      usd: r.usd,
      usdFoil: r.usd_foil,
    },
    ownership: {
      ownedCount: r.owned_count,
      ownedAnyPrinting: r.owned_any_printing,
      availableCount: r.owned_count,
    },
  }));

  const commander =
    d.commander_printing_id != null
      ? {
          oracleId: d.cmd_oracle_id as string,
          name: d.cmd_name as string,
          manaCost: d.cmd_mana_cost as string | null,
          cmc: d.cmd_cmc as string | null,
          typeLine: d.cmd_type_line as string | null,
          oracleText: d.cmd_oracle_text as string | null,
          colors: d.cmd_colors as string[] | null,
          colorIdentity: d.cmd_color_identity as string[] | null,
          keywords: d.cmd_keywords as string[] | null,
          printing: {
            id: d.cmd_printing_id as string,
            setCode: d.cmd_set_code as string,
            setName: d.cmd_set_name as string,
            collectorNumber: d.cmd_collector_number as string,
            imageUris: d.cmd_image_uris as Record<string, string> | null,
            cardFaces: d.cmd_card_faces as
              | Array<{ image_uris?: Record<string, string> | null }>
              | null,
            usd: d.cmd_usd as string | null,
            usdFoil: d.cmd_usd_foil as string | null,
          },
        }
      : null;

  const partner =
    d.partner_printing_id != null
      ? {
          oracleId: d.pa_oracle_id as string,
          name: d.pa_name as string,
          manaCost: d.pa_mana_cost as string | null,
          cmc: d.pa_cmc as string | null,
          typeLine: d.pa_type_line as string | null,
          oracleText: d.pa_oracle_text as string | null,
          colors: d.pa_colors as string[] | null,
          colorIdentity: d.pa_color_identity as string[] | null,
          keywords: d.pa_keywords as string[] | null,
          printing: {
            id: d.pa_printing_id as string,
            setCode: d.pa_set_code as string,
            setName: d.pa_set_name as string,
            collectorNumber: d.pa_collector_number as string,
            imageUris: d.pa_image_uris as Record<string, string> | null,
            cardFaces: d.pa_card_faces as
              | Array<{ image_uris?: Record<string, string> | null }>
              | null,
            usd: d.pa_usd as string | null,
            usdFoil: d.pa_usd_foil as string | null,
          },
        }
      : null;

  const colorIdentity = [
    ...new Set([
      ...((commander?.colorIdentity as string[] | null) ?? []),
      ...((partner?.colorIdentity as string[] | null) ?? []),
    ]),
  ];

  let totalValue = 0;
  for (const c of cards)
    totalValue += c.deckCardRow.quantity * Number.parseFloat(c.printing.usd ?? "0");
  if (commander?.printing.usd)
    totalValue += Number.parseFloat(commander.printing.usd);
  if (partner?.printing.usd)
    totalValue += Number.parseFloat(partner.printing.usd);

  const totalCards =
    cards.reduce((s, c) => s + c.deckCardRow.quantity, 0) +
    (commander ? 1 : 0) +
    (partner ? 1 : 0);

  return {
    deck: {
      id: d.id as string,
      name: d.name as string,
      commanderPrintingId: d.commander_printing_id as string | null,
      partnerPrintingId: d.partner_printing_id as string | null,
      targetBracket: d.target_bracket as number | null,
      archetype: d.archetype as string | null,
      notes: d.notes as string | null,
      isPrimary: d.is_primary as boolean,
      createdAt: toIso(d.created_at) ?? "",
      updatedAt: toIso(d.updated_at) ?? "",
    },
    commander,
    partner,
    cards,
    totalCards,
    totalValueUsd: Math.round(totalValue * 100) / 100,
    colorIdentity,
  };
}
