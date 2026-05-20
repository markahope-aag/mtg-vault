import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import type {
  InventoryListResponse,
  InventoryRowWithCard,
} from "./types";

const SORT_COLUMN: Record<string, string> = {
  name: "c.name",
  cmc: "c.cmc",
  usd: "COALESCE(p.usd::numeric, 0)",
  acquiredAt: "i.acquired_at",
  condition: "i.condition",
  location: "i.location",
  createdAt: "i.created_at",
};

export type ListFilters = {
  name?: string;
  colors?: string[];
  type?: string;
  set?: string;
  ownedOnly?: boolean;
  foilOnly?: boolean;
  location?: string;
  includeDisposed?: boolean;
};

export type ListOptions = {
  filters: ListFilters;
  sort: keyof typeof SORT_COLUMN;
  direction: "asc" | "desc";
  offset: number;
  limit: number;
};

function buildWhere(filters: ListFilters): SQL {
  const clauses: SQL[] = [];
  if (filters.name && filters.name.trim()) {
    clauses.push(sql`c.name ILIKE ${"%" + filters.name.trim() + "%"}`);
  }
  if (filters.colors && filters.colors.length > 0) {
    // Color identity must be a subset of the requested colors set
    // OR contain any of them. Spec is ambiguous; use "contains any".
    clauses.push(sql`c.color_identity && ${filters.colors}::text[]`);
  }
  if (filters.type && filters.type.trim()) {
    clauses.push(sql`c.type_line ILIKE ${"%" + filters.type.trim() + "%"}`);
  }
  if (filters.set && filters.set.trim()) {
    clauses.push(sql`p.set_code ILIKE ${filters.set.trim().toLowerCase()}`);
  }
  if (filters.foilOnly) clauses.push(sql`i.foil = true`);
  if (filters.location && filters.location.trim()) {
    clauses.push(sql`i.location = ${filters.location.trim()}`);
  }
  if (!filters.includeDisposed) clauses.push(sql`i.disposed_at IS NULL`);

  if (clauses.length === 0) return sql`TRUE`;
  return clauses.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`));
}

export async function listInventory(
  opts: ListOptions,
): Promise<InventoryListResponse> {
  const where = buildWhere(opts.filters);
  const sortCol = SORT_COLUMN[opts.sort] ?? SORT_COLUMN.createdAt;
  const dir = opts.direction === "asc" ? sql`ASC` : sql`DESC`;
  const nulls = opts.direction === "asc" ? sql`NULLS LAST` : sql`NULLS LAST`;

  const rowsResult = (await db.execute(sql`
    SELECT
      i.id, i.printing_id, i.foil, i.etched, i.condition, i.language,
      i.location, i.physical_id, i.acquired_price, i.acquired_at,
      i.purchased_from, i.grading_company, i.grade, i.notes,
      i.disposed_to, i.disposed_price, i.disposed_at,
      i.created_at, i.updated_at,
      c.oracle_id, c.name, c.mana_cost, c.type_line, c.color_identity, c.cmc,
      p.set_code, p.set_name, p.collector_number, p.rarity,
      p.usd, p.usd_foil, p.usd_etched,
      (p.image_uris ->> 'small') AS image_uri
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE ${where}
    ORDER BY (i.disposed_at IS NOT NULL) ASC,
             ${sql.raw(sortCol)} ${dir} ${nulls},
             i.id ASC
    LIMIT ${opts.limit}
    OFFSET ${opts.offset};
  `)) as unknown as Array<{
    id: string;
    printing_id: string;
    foil: boolean;
    etched: boolean;
    condition: string;
    language: string;
    location: string | null;
    physical_id: string | null;
    acquired_price: string | null;
    acquired_at: Date | null;
    purchased_from: string | null;
    grading_company: string | null;
    grade: string | null;
    notes: string | null;
    disposed_to: string | null;
    disposed_price: string | null;
    disposed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string | null;
    color_identity: string[] | null;
    cmc: string | null;
    set_code: string;
    set_name: string;
    collector_number: string;
    rarity: string | null;
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
    image_uri: string | null;
  }>;

  const aggResult = (await db.execute(sql`
    SELECT
      count(*)::int AS total_count,
      COALESCE(SUM(
        CASE
          WHEN i.etched = true THEN COALESCE(p.usd_etched::numeric, 0)
          WHEN i.foil = true THEN COALESCE(p.usd_foil::numeric, 0)
          ELSE COALESCE(p.usd::numeric, 0)
        END
      ), 0)::numeric(14,2) AS total_value
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE ${where};
  `)) as unknown as Array<{ total_count: number; total_value: string }>;

  const totals = aggResult[0] ?? { total_count: 0, total_value: "0" };

  const rows: InventoryRowWithCard[] = rowsResult.map((r) => ({
    id: r.id,
    printingId: r.printing_id,
    foil: r.foil,
    etched: r.etched,
    condition: r.condition,
    language: r.language,
    location: r.location,
    physicalId: r.physical_id,
    acquiredPrice: r.acquired_price,
    acquiredAt: r.acquired_at ? r.acquired_at.toISOString() : null,
    purchasedFrom: r.purchased_from,
    gradingCompany: r.grading_company,
    grade: r.grade,
    notes: r.notes,
    disposedTo: r.disposed_to,
    disposedPrice: r.disposed_price,
    disposedAt: r.disposed_at ? r.disposed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    oracleId: r.oracle_id,
    name: r.name,
    manaCost: r.mana_cost,
    typeLine: r.type_line,
    colorIdentity: r.color_identity,
    cmc: r.cmc,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    rarity: r.rarity,
    usd: r.usd,
    usdFoil: r.usd_foil,
    usdEtched: r.usd_etched,
    imageUri: r.image_uri,
  }));

  const nextCursor =
    rows.length === opts.limit ? String(opts.offset + opts.limit) : null;

  return {
    rows,
    nextCursor,
    totalCount: totals.total_count,
    totalValueUsd: Number.parseFloat(String(totals.total_value)) || 0,
  };
}
