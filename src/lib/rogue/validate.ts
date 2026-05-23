/**
 * Deterministic deck validation for the Rogue Deck Builder.
 *
 * Resolves a list of card names → oracle ids and checks every Commander
 * rule the AI generator is supposed to follow. The LLM never certifies its
 * own rule compliance — this function is the one source of truth for
 * "is the deck legal?"
 *
 * Returns a list of violations the caller (Phase B/C repair pass) can feed
 * back to the model with a narrow "fix exactly this" prompt.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ANY_NUMBER_ALLOWED_NAMES } from "@/lib/curated/any-number-allowed";

export type ViolationType =
  | "unresolved"
  | "off_color"
  | "illegal"
  | "singleton"
  | "gamechanger_over_bracket"
  | "mld_over_bracket"
  | "extra_turns_over_bracket"
  | "wrong_count"
  | "duplicate_nonbasic";

export type Violation = {
  type: ViolationType;
  oracleId?: string;
  cardName: string;
  detail: string;
};

export type ResolvedCard = {
  oracleId: string;
  name: string;
  colorIdentity: string[];
  typeLine: string;
};

export type ValidationMetrics = {
  gameChangerCount: number;
  mldCount: number;
  extraTurnCount: number;
  cardCount: number;
  landCount: number;
};

export type ValidationResult = {
  resolved: ResolvedCard[];
  violations: Violation[];
  metrics: ValidationMetrics;
  isClean: boolean;
};

// Bracket policy. The numbers below match the existing bracket-engine
// thresholds the user defined for the Coach panel; kept in lock-step so
// generator output and the displayed bracket badge always agree.
const BRACKET_RULES = {
  // <= max → flagged. null = no cap at this bracket.
  gameChangers: { 1: 0, 2: 0, 3: 3, 4: null, 5: null } as Record<number, number | null>,
  mld: { 1: 0, 2: 0, 3: null, 4: null, 5: null } as Record<number, number | null>,
  extraTurns: { 1: 0, 2: 0, 3: 2, 4: null, 5: null } as Record<number, number | null>,
};

type CardRow = {
  oracle_id: string;
  name: string;
  type_line: string | null;
  color_identity: string[] | null;
  is_commander_legal: boolean | null;
  is_game_changer: boolean | null;
  is_mass_land_denial: boolean | null;
  is_extra_turn: boolean | null;
};

/**
 * Validate a deck given a list of card names + the commander's oracle id +
 * the target bracket. Returns deterministic violations + metrics.
 *
 * The card-names path (not oracle ids) is intentional: the AI generator
 * outputs names, and the resolution step is itself a violation point
 * (hallucinated names → "unresolved"). Feeding names through here means
 * the validator catches that class of error too.
 */
export async function validateDeck(
  cardNames: string[],
  commanderOracleId: string,
  targetBracket: number | null,
): Promise<ValidationResult> {
  const violations: Violation[] = [];
  const resolved: ResolvedCard[] = [];

  // Empty case is degenerate but handled cleanly.
  if (cardNames.length === 0 || !commanderOracleId) {
    return {
      resolved: [],
      violations: [],
      metrics: {
        gameChangerCount: 0,
        mldCount: 0,
        extraTurnCount: 0,
        cardCount: 0,
        landCount: 0,
      },
      isClean: true,
    };
  }

  // 1) Resolve names → cards. Case-insensitive exact match; one row per
  //    unique name. We don't trigram-fuzzy here — that masks AI typos
  //    rather than surfacing them as "unresolved" violations.
  const uniqueNames = [...new Set(cardNames.map((n) => n.trim()))];
  const lookupRows = (await db.execute(sql`
    SELECT oracle_id, name, type_line, color_identity, is_commander_legal,
           is_game_changer, is_mass_land_denial, is_extra_turn
    FROM cards
    WHERE lower(name) = ANY(ARRAY[${sql.join(
      uniqueNames.map((n) => sql`lower(${n})`),
      sql`, `,
    )}])
  `)) as unknown as CardRow[];
  const byLowerName = new Map<string, CardRow>();
  for (const r of lookupRows) byLowerName.set(r.name.toLowerCase(), r);

  // 2) Resolve the commander row too so we have its color identity for the
  //    off-color check (the commander's CI bounds the whole deck).
  const commanderRows = (await db.execute(sql`
    SELECT oracle_id, name, color_identity
    FROM cards WHERE oracle_id = ${commanderOracleId} LIMIT 1
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    color_identity: string[] | null;
  }>;
  const commanderCi = new Set(commanderRows[0]?.color_identity ?? []);

  // Count how many times each name was requested so the singleton check
  // catches "the model put Sol Ring in the list twice."
  const requestedCount = new Map<string, number>();
  for (const n of cardNames) {
    const key = n.trim().toLowerCase();
    requestedCount.set(key, (requestedCount.get(key) ?? 0) + 1);
  }

  let gameChangerCount = 0;
  let mldCount = 0;
  let extraTurnCount = 0;
  let landCount = 0;

  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    const row = byLowerName.get(lower);
    if (!row) {
      violations.push({
        type: "unresolved",
        cardName: name,
        detail: `No card named "${name}" in the database — likely an AI hallucination.`,
      });
      continue;
    }
    const requested = requestedCount.get(lower) ?? 1;

    // Off-color check (commander identity bounds the deck).
    const cardCi = row.color_identity ?? [];
    const offColor = cardCi.filter((c) => !commanderCi.has(c));
    if (offColor.length > 0) {
      violations.push({
        type: "off_color",
        oracleId: row.oracle_id,
        cardName: row.name,
        detail: `Outside commander color identity (card has ${cardCi.join("") || "—"}, commander allows ${[...commanderCi].join("") || "—"}).`,
      });
    }

    // Commander-legality check.
    if (row.is_commander_legal === false) {
      violations.push({
        type: "illegal",
        oracleId: row.oracle_id,
        cardName: row.name,
        detail: "Banned or not legal in Commander.",
      });
    }

    // Singleton check. Basics + curated any-number-allowed names exempt.
    const isBasic = /Basic Land/i.test(row.type_line ?? "");
    const isAnyNumberAllowed = ANY_NUMBER_ALLOWED_NAMES.has(row.name);
    if (requested > 1 && !isBasic && !isAnyNumberAllowed) {
      violations.push({
        type: "duplicate_nonbasic",
        oracleId: row.oracle_id,
        cardName: row.name,
        detail: `Listed ${requested} times — Commander is singleton outside basics and named-card exceptions.`,
      });
    }

    if (isBasic || /\bLand\b/i.test(row.type_line ?? "")) landCount += requested;
    if (row.is_game_changer) gameChangerCount += requested;
    if (row.is_mass_land_denial) mldCount += requested;
    if (row.is_extra_turn) extraTurnCount += requested;

    resolved.push({
      oracleId: row.oracle_id,
      name: row.name,
      colorIdentity: cardCi,
      typeLine: row.type_line ?? "",
    });
  }

  // Card count check: Commander decks are 99 + commander (or 98 + commander
  // + partner). We don't know about partners here, so a soft check: flag
  // when count is wildly outside the legal range. Treat the commander as
  // included implicitly in the +1.
  const totalCount = cardNames.length;
  // 99 main + 1 commander = 100; +1 more for partner. Tolerate both shapes.
  if (totalCount !== 99 && totalCount !== 98) {
    violations.push({
      type: "wrong_count",
      cardName: "(deck)",
      detail: `Deck has ${totalCount} non-commander cards; Commander needs 99 (or 98 with a partner).`,
    });
  }

  // Bracket caps.
  if (targetBracket != null) {
    const gcCap = BRACKET_RULES.gameChangers[targetBracket];
    if (gcCap != null && gameChangerCount > gcCap) {
      violations.push({
        type: "gamechanger_over_bracket",
        cardName: "(deck)",
        detail: `Bracket ${targetBracket} caps Game Changers at ${gcCap}; deck has ${gameChangerCount}.`,
      });
    }
    const mldCap = BRACKET_RULES.mld[targetBracket];
    if (mldCap != null && mldCount > mldCap) {
      violations.push({
        type: "mld_over_bracket",
        cardName: "(deck)",
        detail: `Bracket ${targetBracket} disallows Mass Land Denial; deck has ${mldCount}.`,
      });
    }
    const etCap = BRACKET_RULES.extraTurns[targetBracket];
    if (etCap != null && extraTurnCount > etCap) {
      violations.push({
        type: "extra_turns_over_bracket",
        cardName: "(deck)",
        detail: `Bracket ${targetBracket} caps Extra Turn spells at ${etCap}; deck has ${extraTurnCount}.`,
      });
    }
  }

  return {
    resolved,
    violations,
    metrics: {
      gameChangerCount,
      mldCount,
      extraTurnCount,
      cardCount: totalCount,
      landCount,
    },
    isClean: violations.length === 0,
  };
}
