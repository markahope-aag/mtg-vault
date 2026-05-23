import type { SpellbookCombo } from "@/lib/spellbook";
import type {
  BracketReason,
  BracketResult,
  Removal,
} from "@/lib/bracket-engine-types";

export type FlaggedCard = {
  oracleId: string;
  name: string;
  edhrecRank: number | null;
  usd: number | null;
  isGameChanger: boolean;
  isMassLandDenial: boolean;
  isExtraTurn: boolean;
  isTutor: boolean;
};

export type BracketEvaluationInput = {
  declaredAsCedh?: boolean;
  gameChangers: FlaggedCard[];
  mld: FlaggedCard[];
  extraTurns: FlaggedCard[];
  tutorCount: number;
  twoCardCombos: SpellbookCombo[];
  multiCardCombos: SpellbookCombo[];
  spellbookAvailable: boolean;
};

export function sortByRemovalPriority(cards: FlaggedCard[]): FlaggedCard[] {
  return [...cards].sort((a, b) => {
    const ra = a.edhrecRank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.edhrecRank ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return rb - ra;
    return (b.usd ?? 0) - (a.usd ?? 0);
  });
}

export function pickComboPieceToRemove(
  combo: SpellbookCombo,
  flagged: Map<string, FlaggedCard>,
  removalsSoFar: Set<string>,
): Removal | null {
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

export function evaluateBracketRules(input: BracketEvaluationInput): {
  bracket: 1 | 2 | 3 | 4 | 5;
  confidence: BracketResult["confidence"];
  reasons: BracketReason[];
} {
  const {
    declaredAsCedh,
    gameChangers,
    mld,
    extraTurns,
    tutorCount,
    twoCardCombos,
    multiCardCombos,
    spellbookAvailable,
  } = input;

  const reasons: BracketReason[] = [];
  let bracket: 1 | 2 | 3 | 4 | 5 = 2;
  let confidence: BracketResult["confidence"] = "calculated";

  if (declaredAsCedh) {
    bracket = 5;
    confidence = "declared";
    reasons.push({
      severity: "note",
      text: "Declared as cEDH by user (target bracket = 5).",
      category: "intent",
    });
  } else {
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

  return { bracket, confidence, reasons };
}

export function buildToReachBracketDiffs(input: {
  bracket: 1 | 2 | 3 | 4 | 5;
  gameChangers: FlaggedCard[];
  mld: FlaggedCard[];
  extraTurns: FlaggedCard[];
  twoCardCombos: SpellbookCombo[];
  flagged: Map<string, FlaggedCard>;
}): BracketResult["toReachBracket"] {
  const { bracket, gameChangers, mld, extraTurns, twoCardCombos, flagged } =
    input;

  const toReachBracket: BracketResult["toReachBracket"] = {};

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
    for (const combo of twoCardCombos) {
      const pick = pickComboPieceToRemove(combo, flagged, removalIds);
      if (pick) {
        removals.push(pick);
        if (pick.oracleId) removalIds.add(pick.oracleId);
      }
    }
    toReachBracket[3] = { remove: removals };
  }

  return toReachBracket;
}
