import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const SPELLBOOK_URL =
  "https://backend.commanderspellbook.com/estimate-bracket";
const SPELLBOOK_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  "Content-Type": "application/json",
  Accept: "application/json",
};
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;

export class SpellbookUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpellbookUnavailableError";
  }
}

export type SpellbookCombo = {
  id: string;
  name: string;
  resultText: string;
  pieces: Array<{ oracleId: string | null; name: string }>;
};

export type SpellbookResult = {
  twoCardCombos: SpellbookCombo[];
  multiCardCombos: SpellbookCombo[];
  spellbookBracket: 1 | 2 | 3 | 4 | 5 | null;
  spellbookBracketTag: string | null;
};

// Spellbook returns letter-coded brackets. Map to our 1-5 scale.
function mapBracketTag(tag: string): 1 | 2 | 3 | 4 | 5 | null {
  switch (tag) {
    case "E":
      return 1;
    case "C":
      return 2;
    case "P":
      return 3;
    case "S":
      return 4;
    case "O":
      return 4;
    case "R":
      return 5;
    case "B":
      return null;
    default:
      return null;
  }
}

// Best-effort extraction of combo pieces from Spellbook's classified-variant
// shape. The API surface is loosely documented; we accept several keys and
// fall back gracefully so a shape change doesn't break the engine entirely.
type RawCombo = {
  id?: string | number;
  name?: string;
  result?: string;
  resultText?: string;
  produces?: Array<{ name?: string }>;
  uses?: Array<{ card?: { oracleId?: string; name?: string }; quantity?: number }>;
  cards?: Array<{ oracleId?: string; name?: string; card?: { name?: string } }>;
  pieces?: Array<{ oracleId?: string; name?: string }>;
};

function extractPieces(combo: RawCombo): SpellbookCombo["pieces"] {
  const out: SpellbookCombo["pieces"] = [];
  const seen = new Set<string>();
  const push = (oracleId: string | null, name: string | null | undefined) => {
    if (!name) return;
    const key = `${oracleId ?? ""}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ oracleId, name });
  };
  if (Array.isArray(combo.uses)) {
    for (const u of combo.uses) {
      push(u.card?.oracleId ?? null, u.card?.name);
    }
  }
  if (Array.isArray(combo.cards)) {
    for (const c of combo.cards) {
      push(c.oracleId ?? null, c.name ?? c.card?.name);
    }
  }
  if (Array.isArray(combo.pieces)) {
    for (const p of combo.pieces) {
      push(p.oracleId ?? null, p.name);
    }
  }
  return out;
}

function summariseResult(combo: RawCombo): string {
  if (combo.resultText) return combo.resultText;
  if (combo.result) return combo.result;
  if (Array.isArray(combo.produces) && combo.produces.length > 0) {
    return combo.produces
      .map((p) => p.name)
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

async function lookupNames(oracleIds: string[]): Promise<Map<string, string>> {
  if (oracleIds.length === 0) return new Map();
  const rows = (await db.execute(sql`
    SELECT oracle_id, name
    FROM cards
    WHERE oracle_id = ANY(${oracleIds}::uuid[])
  `)) as unknown as Array<{ oracle_id: string; name: string }>;
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.oracle_id, r.name);
  return map;
}

const cache = new Map<string, { value: SpellbookResult; expires: number }>();

function cacheKey(commanderIds: string[], mainIds: string[]): string {
  return `${[...commanderIds].sort().join(",")}|${[...mainIds].sort().join(",")}`;
}

export async function estimateBracket(input: {
  commanderOracleIds: string[];
  mainOracleIds: string[];
}): Promise<SpellbookResult> {
  const key = cacheKey(input.commanderOracleIds, input.mainOracleIds);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const allIds = [...input.commanderOracleIds, ...input.mainOracleIds];
  const names = await lookupNames(allIds);

  const commanders = input.commanderOracleIds
    .map((id) => names.get(id))
    .filter((n): n is string => !!n)
    .map((card) => ({ card, quantity: 1 }));

  // Spellbook caps main at 600.
  const mainCardSet = new Set<string>();
  const main: Array<{ card: string; quantity: number }> = [];
  for (const id of input.mainOracleIds) {
    const name = names.get(id);
    if (!name) continue;
    if (mainCardSet.has(name)) continue;
    mainCardSet.add(name);
    main.push({ card: name, quantity: 1 });
    if (main.length >= 600) break;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: unknown;
  try {
    const res = await fetch(SPELLBOOK_URL, {
      method: "POST",
      headers: SPELLBOOK_HEADERS,
      body: JSON.stringify({ commanders, main }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status >= 500 || res.status === 429) {
      throw new SpellbookUnavailableError(
        `Spellbook ${res.status} ${res.statusText}`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Spellbook ${res.status}: ${body || res.statusText}`);
    }
    raw = await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof SpellbookUnavailableError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new SpellbookUnavailableError("Spellbook request timed out");
    }
    if (err instanceof TypeError) {
      throw new SpellbookUnavailableError(
        `Spellbook unreachable: ${(err as Error).message}`,
      );
    }
    throw err;
  }

  const body = raw as {
    bracketTag?: string;
    combos?: RawCombo[];
  };

  const combos = Array.isArray(body.combos) ? body.combos : [];
  const parsed: SpellbookCombo[] = combos.map((c) => {
    const pieces = extractPieces(c);
    return {
      id: String(c.id ?? ""),
      name: c.name ?? "",
      resultText: summariseResult(c),
      pieces,
    };
  });

  const twoCardCombos = parsed.filter((c) => c.pieces.length === 2);
  const multiCardCombos = parsed.filter((c) => c.pieces.length > 2);

  const result: SpellbookResult = {
    twoCardCombos,
    multiCardCombos,
    spellbookBracketTag: body.bracketTag ?? null,
    spellbookBracket: body.bracketTag ? mapBracketTag(body.bracketTag) : null,
  };

  cache.set(key, { value: result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}
