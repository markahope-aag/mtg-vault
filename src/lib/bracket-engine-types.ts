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

export type CalculateInput = {
  deckId: string;
  cards: Array<{ oracleId: string; quantity: number }>;
  commanderOracleIds: string[];
  commanderColorIdentity: string[];
  declaredAsCedh?: boolean;
};
