import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  estimateBracket,
  SpellbookUnavailableError,
  type SpellbookCombo,
} from "@/lib/spellbook";
import { sqlArray } from "@/lib/sql";
import {
  buildToReachBracketDiffs,
  evaluateBracketRules,
  type FlaggedCard,
} from "@/lib/bracket-engine-logic";

export type {
  BracketReason,
  BracketResult,
  CalculateInput,
  Removal,
} from "@/lib/bracket-engine-types";

import type { BracketResult, CalculateInput } from "@/lib/bracket-engine-types";

async function fetchFlaggedCards(
  oracleIds: string[],
): Promise<Map<string, FlaggedCard>> {
  if (oracleIds.length === 0) return new Map();
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id, c.name, c.edhrec_rank,
      c.is_game_changer, c.is_mass_land_denial, c.is_extra_turn, c.is_tutor,
      (
        SELECT MIN(p.usd::numeric) FROM printings p
        WHERE p.oracle_id = c.oracle_id AND p.usd IS NOT NULL
      ) AS min_usd
    FROM cards c
    WHERE c.oracle_id = ANY(${sqlArray(oracleIds, "uuid")})
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    edhrec_rank: number | null;
    is_game_changer: boolean;
    is_mass_land_denial: boolean;
    is_extra_turn: boolean;
    is_tutor: boolean;
    min_usd: string | null;
  }>;
  const map = new Map<string, FlaggedCard>();
  for (const r of rows) {
    map.set(r.oracle_id, {
      oracleId: r.oracle_id,
      name: r.name,
      edhrecRank: r.edhrec_rank,
      usd: r.min_usd ? Number.parseFloat(r.min_usd) : null,
      isGameChanger: r.is_game_changer,
      isMassLandDenial: r.is_mass_land_denial,
      isExtraTurn: r.is_extra_turn,
      isTutor: r.is_tutor,
    });
  }
  return map;
}

export async function calculateBracket(
  input: CalculateInput,
): Promise<BracketResult> {
  const oracleIds = Array.from(
    new Set([
      ...input.commanderOracleIds,
      ...input.cards.map((c) => c.oracleId),
    ]),
  );
  const flagged = await fetchFlaggedCards(oracleIds);

  const gameChangers: FlaggedCard[] = [];
  const mld: FlaggedCard[] = [];
  const extraTurns: FlaggedCard[] = [];
  let tutorCount = 0;
  for (const f of flagged.values()) {
    if (f.isGameChanger) gameChangers.push(f);
    if (f.isMassLandDenial) mld.push(f);
    if (f.isExtraTurn) extraTurns.push(f);
    if (f.isTutor) tutorCount++;
  }

  let spellbookAvailable = true;
  let twoCardCombos: SpellbookCombo[] = [];
  let multiCardCombos: SpellbookCombo[] = [];
  let spellbookBracket: number | null = null;
  let spellbookBracketTag: string | null = null;
  try {
    const sb = await estimateBracket({
      commanderOracleIds: input.commanderOracleIds,
      mainOracleIds: input.cards.map((c) => c.oracleId),
    });
    twoCardCombos = sb.twoCardCombos;
    multiCardCombos = sb.multiCardCombos;
    spellbookBracket = sb.spellbookBracket;
    spellbookBracketTag = sb.spellbookBracketTag;
  } catch (err) {
    if (err instanceof SpellbookUnavailableError) {
      spellbookAvailable = false;
    } else {
      throw err;
    }
  }

  const deckSize =
    input.cards.reduce((s, c) => s + c.quantity, 0) +
    input.commanderOracleIds.length;

  const { bracket, confidence, reasons } = evaluateBracketRules({
    declaredAsCedh: input.declaredAsCedh,
    gameChangers,
    mld,
    extraTurns,
    tutorCount,
    twoCardCombos,
    multiCardCombos,
    spellbookAvailable,
  });

  const toReachBracket = buildToReachBracketDiffs({
    bracket,
    gameChangers,
    mld,
    extraTurns,
    twoCardCombos,
    flagged,
  });

  return {
    bracket,
    confidence,
    reasons,
    metrics: {
      gameChangerCount: gameChangers.length,
      twoCardComboCount: twoCardCombos.length,
      multiCardComboCount: multiCardCombos.length,
      massLandDenialCount: mld.length,
      extraTurnCount: extraTurns.length,
      tutorCount,
      deckSize,
      commanderColorIdentity: input.commanderColorIdentity,
    },
    toReachBracket,
    spellbookAvailable,
    spellbookBracket,
    spellbookBracketTag,
  };
}
