import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { syncState } from "@/db/schema";
import { MASS_LAND_DENIAL_NAMES } from "@/lib/curated/mld";

const SCRYFALL_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  Accept: "application/json",
};
const SCRYFALL_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchScryfall(url: string): Promise<Response> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!res.ok) {
    throw new Error(`Scryfall ${res.status} ${res.statusText}: ${url}`);
  }
  return res;
}

// ─── 1. Extra-turn flag ──────────────────────────────────────────

export async function updateExtraTurnFlags(): Promise<number> {
  // Cards that explicitly let a player "take an extra turn" — excluding lands
  // (e.g. fastbond lookalikes occasionally match the phrase). We do this in
  // two passes so the flag eventually reflects reality on every row, not just
  // newly-added ones.
  await db.execute(sql`
    UPDATE cards
    SET is_extra_turn = TRUE
    WHERE LOWER(COALESCE(oracle_text, '')) LIKE '%take an extra turn%'
      AND type_line NOT ILIKE '%Land%'
  `);
  await db.execute(sql`
    UPDATE cards
    SET is_extra_turn = FALSE
    WHERE NOT (
      LOWER(COALESCE(oracle_text, '')) LIKE '%take an extra turn%'
      AND type_line NOT ILIKE '%Land%'
    )
  `);
  const rows = (await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM cards WHERE is_extra_turn = TRUE
  `)) as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

// ─── 2. Mass land denial flag ────────────────────────────────────

export async function updateMldFlags(): Promise<number> {
  const names = [...MASS_LAND_DENIAL_NAMES];
  await db.execute(sql`
    UPDATE cards SET is_mass_land_denial = TRUE
    WHERE name = ANY(${names}::text[])
  `);
  await db.execute(sql`
    UPDATE cards SET is_mass_land_denial = FALSE
    WHERE NOT (name = ANY(${names}::text[]))
  `);
  const rows = (await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM cards WHERE is_mass_land_denial = TRUE
  `)) as unknown as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

// ─── 3. Tutor flag (Scryfall is:tutor list) ──────────────────────

export async function updateTutorFlags(): Promise<number> {
  let nextUrl: string | null =
    "https://api.scryfall.com/cards/search?q=is%3Atutor&unique=cards";
  const oracleIds = new Set<string>();

  while (nextUrl) {
    const data = (await fetchScryfall(nextUrl).then((r) => r.json())) as {
      data: Array<{ oracle_id?: string }>;
      has_more: boolean;
      next_page?: string;
    };
    for (const c of data.data ?? []) {
      if (c.oracle_id) oracleIds.add(c.oracle_id);
    }
    nextUrl = data.has_more && data.next_page ? data.next_page : null;
    if (nextUrl) await sleep(SCRYFALL_DELAY_MS);
  }

  if (oracleIds.size === 0) return 0;

  await db.execute(sql`UPDATE cards SET is_tutor = FALSE`);
  await db.execute(sql`
    UPDATE cards SET is_tutor = TRUE
    WHERE oracle_id = ANY(${[...oracleIds]}::uuid[])
  `);
  return oracleIds.size;
}

// ─── 4. Game changer flag (Scryfall is:gamechanger) ─────────────

export async function updateGameChangerFlags(): Promise<number> {
  let nextUrl: string | null =
    "https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards";
  const oracleIds = new Set<string>();

  while (nextUrl) {
    const data = (await fetchScryfall(nextUrl).then((r) => r.json())) as {
      data: Array<{ oracle_id?: string }>;
      has_more: boolean;
      next_page?: string;
    };
    for (const c of data.data ?? []) {
      if (c.oracle_id) oracleIds.add(c.oracle_id);
    }
    nextUrl = data.has_more && data.next_page ? data.next_page : null;
    if (nextUrl) await sleep(SCRYFALL_DELAY_MS);
  }

  await db.execute(sql`UPDATE cards SET is_game_changer = FALSE`);
  if (oracleIds.size > 0) {
    await db.execute(sql`
      UPDATE cards SET is_game_changer = TRUE
      WHERE oracle_id = ANY(${[...oracleIds]}::uuid[])
    `);
  }
  return oracleIds.size;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export type BracketFlagSummary = {
  extraTurnCount: number;
  mldCount: number;
  tutorCount: number;
  gameChangerCount: number;
  durations: Record<string, number>;
  errors: Array<{ step: string; message: string }>;
};

async function runStep<T>(
  label: string,
  fn: () => Promise<T>,
  summary: BracketFlagSummary,
): Promise<T | null> {
  const start = Date.now();
  try {
    const result = await fn();
    summary.durations[label] = Date.now() - start;
    return result;
  } catch (err) {
    summary.errors.push({
      step: label,
      message: err instanceof Error ? err.message : String(err),
    });
    summary.durations[label] = Date.now() - start;
    return null;
  }
}

export async function refreshAllBracketFlags(): Promise<BracketFlagSummary> {
  const summary: BracketFlagSummary = {
    extraTurnCount: 0,
    mldCount: 0,
    tutorCount: 0,
    gameChangerCount: 0,
    durations: {},
    errors: [],
  };

  summary.extraTurnCount =
    (await runStep("extraTurn", updateExtraTurnFlags, summary)) ?? 0;
  summary.mldCount = (await runStep("mld", updateMldFlags, summary)) ?? 0;
  summary.tutorCount =
    (await runStep("tutor", updateTutorFlags, summary)) ?? 0;
  summary.gameChangerCount =
    (await runStep("gameChanger", updateGameChangerFlags, summary)) ?? 0;

  // Persist a snapshot of the run for the admin page.
  const value = {
    extraTurnCount: summary.extraTurnCount,
    mldCount: summary.mldCount,
    tutorCount: summary.tutorCount,
    gameChangerCount: summary.gameChangerCount,
    refreshedAt: new Date().toISOString(),
    errors: summary.errors,
  };
  await db
    .insert(syncState)
    .values({ key: "bracket_flags_last_refreshed", value })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value, updatedAt: sql`now()` },
    });

  return summary;
}
