import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  estimateBracket,
  SpellbookUnavailableError,
  type SpellbookCombo,
} from "@/lib/spellbook";

export type ReasonSeverity = "blocking" | "limiting" | "note";
export type ReasonCategory =
  | "game-changers"
  | "two-card-combos"
  | "multi-card-combos"
  | "mass-land-denial"
  | "extra-turns"
  | "tutors"
  | "intent";

export type BracketReason = {
  severity: ReasonSeverity;
  text: string;
  category: ReasonCategory;
  cards?: Array<{ oracleId: string | null; name: string }>;
};

export type Removal = {
  oracleId: string;
  name: string;
  reason: string;
  criticalForCombo?: string;
};

export type BracketResult = {
  bracket: 1 | 2 | 3 | 4 | 5;
  confidence: "calculated" | "declared" | "conservative";
  reasons: BracketReason[];
  metrics: {
    gameChangerCount: number;
    twoCardComboCount: number;
    multiCardComboCount: number;
    massLandDenialCount: number;
    extraTurnCount: number;
    tutorCount: number;
    deckSize: number;
    commanderColorIdentity: string[];
  };
  toReachBracket: {
    [target: number]: {
      remove: Removal[];
      note?: string;
    };
  };
  spellbookAvailable: boolean;
  spellbookBracket: number | null;
  spellbookBracketTag: string | null;
};

type FlaggedCard = {
  oracleId: string;
  name: string;
  edhrecRank: number | null;
  usd: number | null;
  isGameChanger: boolean;
  isMassLandDenial: boolean;
  isExtraTurn: boolean;
  isTutor: boolean;
};

export type CalculateInput = {
  deckId: string;
  cards: Array<{ oracleId: string; quantity: number }>;
  commanderOracleIds: string[];
  commanderColorIdentity: string[];
  declaredAsCedh?: boolean;
};

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
    WHERE c.oracle_id = ANY(${oracleIds}::uuid[])
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

function sortByRemovalPriority(cards: FlaggedCard[]): FlaggedCard[] {
  // Lowest EDHREC rank (least played) first — "least missed" heuristic.
  // Null ranks sort last (treat as obscure → low priority to remove).
  return [...cards].sort((a, b) => {
    const ra = a.edhrecRank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.edhrecRank ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return rb - ra; // higher (worse) rank first
    return (b.usd ?? 0) - (a.usd ?? 0);
  });
}

function pickComboPieceToRemove(
  combo: SpellbookCombo,
  flagged: Map<string, FlaggedCard>,
  removalsSoFar: Set<string>,
): Removal | null {
  // Prefer a piece already targeted for removal (so removal cascades).
  for (const p of combo.pieces) {
    if (p.oracleId && removalsSoFar.has(p.oracleId)) {
      const f = flagged.get(p.oracleId);
      if (f) {
        return {
          oracleId: f.oracleId,
          name: f.name,
          reason: `Already removed — also breaks combo: ${combo.name || "(unnamed)"}`,
          criticalForCombo: combo.name || combo.id,
        };
      }
    }
  }
  // Otherwise pick the cheapest piece by USD (easier to swap out).
  let best: FlaggedCard | null = null;
  for (const p of combo.pieces) {
    if (!p.oracleId) continue;
    const f = flagged.get(p.oracleId);
    if (!f) continue;
    if (!best) {
      best = f;
      continue;
    }
    if ((f.usd ?? 0) < (best.usd ?? 0)) best = f;
  }
  if (!best) {
    // Spellbook returned pieces without oracle_ids — fall back to name only.
    const first = combo.pieces.find((p) => p.name);
    if (!first) return null;
    return {
      oracleId: first.oracleId ?? "",
      name: first.name,
      reason: `Breaks 2-card combo: ${combo.name || "(unnamed)"}`,
      criticalForCombo: combo.name || combo.id,
    };
  }
  return {
    oracleId: best.oracleId,
    name: best.name,
    reason: `Breaks 2-card combo: ${combo.name || "(unnamed)"}`,
    criticalForCombo: combo.name || combo.id,
  };
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

  // Spellbook for combos
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

  const reasons: BracketReason[] = [];
  let bracket: 1 | 2 | 3 | 4 | 5 = 2;
  let confidence: BracketResult["confidence"] = "calculated";

  // 1. User-declared cEDH
  if (input.declaredAsCedh) {
    bracket = 5;
    confidence = "declared";
    reasons.push({
      severity: "note",
      text: "Declared as cEDH by user (target bracket = 5).",
      category: "intent",
    });
  } else {
    // 2. Bracket 4 (Optimized) — high power without cEDH intent
    if (gameChangers.length > 3) {
      bracket = 4;
      reasons.push({
        severity: "blocking",
        text: `${gameChangers.length} Game Changers exceeds Bracket 3 limit of 3.`,
        category: "game-changers",
        cards: gameChangers.map((c) => ({
          oracleId: c.oracleId,
          name: c.name,
        })),
      });
    }
    if (twoCardCombos.length > 0) {
      bracket = Math.max(bracket, 4) as 1 | 2 | 3 | 4 | 5;
      reasons.push({
        severity: "blocking",
        text: `${twoCardCombos.length} two-card infinite combo${twoCardCombos.length === 1 ? "" : "s"} detected.`,
        category: "two-card-combos",
        cards: twoCardCombos.flatMap((c) =>
          c.pieces.map((p) => ({ oracleId: p.oracleId, name: p.name })),
        ),
      });
    }

    if (bracket === 4) {
      // Surface "looks like cEDH" hint when the metrics scream tournament.
      if (
        gameChangers.length >= 5 &&
        twoCardCombos.length >= 1 &&
        tutorCount >= 5
      ) {
        reasons.push({
          severity: "note",
          text: "This deck has cEDH-level characteristics. If built for tournament play, set the target bracket to 5 (cEDH) manually.",
          category: "intent",
        });
      }
    } else {
      // 3. Bracket 3 (Upgraded)
      const triggers: BracketReason[] = [];
      if (gameChangers.length >= 1) {
        triggers.push({
          severity: "blocking",
          text: `${gameChangers.length} Game Changer${gameChangers.length === 1 ? "" : "s"} — Bracket 2 and below allow none.`,
          category: "game-changers",
          cards: gameChangers.map((c) => ({
            oracleId: c.oracleId,
            name: c.name,
          })),
        });
      }
      if (extraTurns.length >= 3) {
        triggers.push({
          severity: "limiting",
          text: `${extraTurns.length} extra-turn cards — chaining risk above Bracket 2.`,
          category: "extra-turns",
          cards: extraTurns.map((c) => ({
            oracleId: c.oracleId,
            name: c.name,
          })),
        });
      }
      if (mld.length > 0) {
        triggers.push({
          severity: "blocking",
          text: `${mld.length} mass land denial card${mld.length === 1 ? "" : "s"} — not appropriate for Bracket 2.`,
          category: "mass-land-denial",
          cards: mld.map((c) => ({ oracleId: c.oracleId, name: c.name })),
        });
      }
      if (multiCardCombos.length > 0) {
        triggers.push({
          severity: "limiting",
          text: `${multiCardCombos.length} ${multiCardCombos.length === 1 ? "combo" : "combos"} of 3+ pieces detected.`,
          category: "multi-card-combos",
          cards: multiCardCombos.flatMap((c) =>
            c.pieces.map((p) => ({ oracleId: p.oracleId, name: p.name })),
          ),
        });
      }
      if (triggers.length > 0) {
        bracket = 3;
        reasons.push(...triggers);
      } else {
        bracket = 2;
        reasons.push({
          severity: "note",
          text: "No Game Changers, no infinite combos detected, no mass land denial, low extra-turn count.",
          category: "intent",
        });
      }
    }
  }

  if (!spellbookAvailable) {
    confidence = "conservative";
    reasons.push({
      severity: "note",
      text: "Combo detection unavailable (Commander Spellbook). Calculated bracket may be conservative.",
      category: "intent",
    });
  }

  // toReachBracket diffs
  const toReachBracket: BracketResult["toReachBracket"] = {};

  // Always include a B1 note — we never auto-classify Bracket 1.
  toReachBracket[1] = {
    remove: [],
    note: "Bracket 1 (Exhibition) requires thematic intent and roughly precon-equivalent power. This cannot be auto-determined; declare it via the deck's target bracket if you intend it.",
  };

  if (bracket >= 3) {
    const removals: Removal[] = [];
    for (const gc of gameChangers) {
      removals.push({
        oracleId: gc.oracleId,
        name: gc.name,
        reason: "Game Changer — not allowed in Bracket 2.",
      });
    }
    for (const m of mld) {
      removals.push({
        oracleId: m.oracleId,
        name: m.name,
        reason: "Mass land denial — not appropriate for Bracket 2.",
      });
    }
    if (extraTurns.length >= 3) {
      const sorted = sortByRemovalPriority(extraTurns);
      for (let i = 0; i < extraTurns.length - 2; i++) {
        removals.push({
          oracleId: sorted[i].oracleId,
          name: sorted[i].name,
          reason: "Extra turn — reduce to ≤2 for Bracket 2.",
        });
      }
    }
    toReachBracket[2] = { remove: removals };
  }

  if (bracket >= 4) {
    const removals: Removal[] = [];
    const removalIds = new Set<string>();
    // Reduce Game Changers to ≤3 — drop lowest-priority first.
    if (gameChangers.length > 3) {
      const sorted = sortByRemovalPriority(gameChangers);
      const toDrop = sorted.slice(0, gameChangers.length - 3);
      for (const gc of toDrop) {
        removals.push({
          oracleId: gc.oracleId,
          name: gc.name,
          reason: "Game Changer over the Bracket 3 cap of 3.",
        });
        removalIds.add(gc.oracleId);
      }
    }
    // Break each two-card combo with one removal.
    for (const combo of twoCardCombos) {
      const pick = pickComboPieceToRemove(combo, flagged, removalIds);
      if (pick) {
        removals.push(pick);
        if (pick.oracleId) removalIds.add(pick.oracleId);
      }
    }
    toReachBracket[3] = { remove: removals };
  }

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
