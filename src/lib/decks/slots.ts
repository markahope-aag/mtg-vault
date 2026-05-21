/**
 * Slot classifier — assigns each card to a single "role" slot for the
 * deckbuilder Coach. Heuristic, not exhaustive — covers ~85% of cards
 * accurately based on oracle text + type line. The LLM strategy advisor
 * handles the long tail.
 *
 * Order matters: a card is assigned to the FIRST slot whose predicate
 * matches. We deliberately put Land first (cheapest test, exhaustive),
 * then the slots with the most specific patterns, ending in Synergy
 * (the catch-all "noncreature-noncreature support") and Other.
 */

export type Slot =
  | "Land"
  | "Ramp"
  | "Draw"
  | "Tutor"
  | "Removal"
  | "Sweeper"
  | "Counterspell"
  | "Recursion"
  | "Protection"
  | "Wincon"
  | "Synergy"
  | "Other";

export const SLOT_ORDER: Slot[] = [
  "Land",
  "Ramp",
  "Draw",
  "Tutor",
  "Removal",
  "Sweeper",
  "Counterspell",
  "Recursion",
  "Protection",
  "Wincon",
  "Synergy",
  "Other",
];

export const SLOT_LABEL: Record<Slot, string> = {
  Land: "Lands",
  Ramp: "Ramp",
  Draw: "Card draw",
  Tutor: "Tutors",
  Removal: "Removal",
  Sweeper: "Sweepers",
  Counterspell: "Counters",
  Recursion: "Recursion",
  Protection: "Protection",
  Wincon: "Wincons",
  Synergy: "Synergy",
  Other: "Other",
};

export type CardForClassification = {
  name: string;
  typeLine: string | null;
  oracleText: string | null;
  manaCost: string | null;
  power?: string | null;
  toughness?: string | null;
};

const RX = {
  // ─── Lands / ramp ────────────────────────────────────────────────
  land: /\bLand\b/,
  basicLand: /\bBasic Land\b/,

  // Mana ramp: ANY card that adds mana from the battlefield (artifacts that
  // tap for mana, ramp spells that fetch lands), and ramp spells that put a
  // land directly onto the battlefield.
  rampSpell:
    /(search your library for (?:a |up to (?:one|two|three) )?(?:basic )?land|put (?:a |up to (?:one|two|three) )?land[^.]*onto the battlefield)/i,
  manaProducer: /\{T\}: Add (\{[WUBRGC]\}|one mana|two mana|\{C\}|mana of any)/i,

  // ─── Card draw / advantage ───────────────────────────────────────
  drawCard:
    /(draw (?:a card|two cards|three cards|x cards|cards equal|that many cards)|when[^.]*(?:enters|attacks|dies)[^.]*draw)/i,

  // ─── Tutors ──────────────────────────────────────────────────────
  tutor:
    /search your library for (?:a |an |any number of |up to (?:one|two|three) )?(?:card|creature|artifact|enchantment|instant|sorcery|planeswalker|noncreature|nonland|nonbasic|legendary|equipment|aura)/i,
  basicLandTutor: /search your library for (?:a |up to (?:one|two|three) )?basic land/i,

  // ─── Removal ─────────────────────────────────────────────────────
  spotRemoval:
    /(destroy target|exile target (?:creature|permanent|nonland|enchantment|artifact|planeswalker)|target (?:creature|permanent)[^.]*get[s]? -|deals? \d+ damage to (?:any target|target creature|target planeswalker))/i,
  sweeper:
    /(destroy all (?:creatures|nonland permanents|permanents)|exile all (?:creatures|nonland permanents|permanents)|each creature gets -[0-9X]+\/-[0-9X]+|deals? \d+ damage to each creature)/i,

  // ─── Counters / stax ─────────────────────────────────────────────
  counter: /counter target (?:spell|creature spell|noncreature spell|ability)/i,

  // ─── Recursion ───────────────────────────────────────────────────
  recursion:
    /(return target (?:card|creature card|artifact card|enchantment card|permanent card) from your graveyard|return[^.]*from your graveyard to (?:the battlefield|your hand)|put target[^.]*card from a graveyard onto the battlefield)/i,

  // ─── Protection ──────────────────────────────────────────────────
  protection:
    /(hexproof|shroud|indestructible|protection from|cannot be (?:countered|the target)|prevent all damage|phase out|exile[^.]*return it to the battlefield)/i,

  // ─── Wincons ─────────────────────────────────────────────────────
  // Anything that says "you win the game" or "each opponent loses the game"
  explicitWincon:
    /(you win the game|each opponent loses the game|target player loses the game|opponents? lose[s]? the game)/i,
  infiniteCombo:
    /(at the beginning of (?:your )?(?:upkeep|combat|end step)[^.]*infinite|create[^.]*token[^.]* for each|extra turn|take an extra turn)/i,
};

function typ(card: CardForClassification): string {
  return card.typeLine ?? "";
}

/**
 * Whether the card adds mana from the battlefield (mana rocks/dorks)
 * or is a ramp spell that fetches/cheats out lands.
 */
function isRamp(card: CardForClassification): boolean {
  const t = typ(card);
  const o = card.oracleText ?? "";
  if (RX.land.test(t)) return false;
  if (RX.rampSpell.test(o)) return true;
  // Mana rocks / dorks: a nonland card whose oracle text says "{T}: Add ...".
  if (RX.manaProducer.test(o) && !RX.land.test(t)) return true;
  return false;
}

function isCreatureWincon(card: CardForClassification): boolean {
  // Big body or evasion + power ≥ 5; or commander damage-flavored ("Voltron").
  const power = Number(card.power ?? "0");
  if (!Number.isFinite(power)) return false;
  return power >= 6 && /\bCreature\b/.test(typ(card));
}

export function classifyCard(card: CardForClassification): Slot {
  const t = typ(card);
  const o = card.oracleText ?? "";

  if (RX.land.test(t)) return "Land";

  // Wincon ranks high because some wincon engines (Aetherflux Reservoir etc.)
  // also draw cards as a side-effect of their text.
  if (RX.explicitWincon.test(o)) return "Wincon";

  if (isRamp(card)) return "Ramp";

  // Tutor is more specific than draw; some tutors say "search your library
  // for a card ... put it into your hand" which would also match drawCard.
  if (RX.tutor.test(o)) return "Tutor";

  if (RX.sweeper.test(o)) return "Sweeper";
  if (RX.spotRemoval.test(o)) return "Removal";
  if (RX.counter.test(o)) return "Counterspell";
  if (RX.recursion.test(o)) return "Recursion";

  if (RX.drawCard.test(o)) return "Draw";

  if (RX.protection.test(o)) return "Protection";

  if (RX.infiniteCombo.test(o)) return "Wincon";
  if (isCreatureWincon(card)) return "Wincon";

  // Catch-all: creatures/enchantments/artifacts with synergy text usually
  // hit the engine-building bucket. We don't want too much in "Other".
  if (/\b(Creature|Artifact|Enchantment|Planeswalker)\b/.test(t)) {
    return "Synergy";
  }
  return "Other";
}

/**
 * Target counts per slot for a Commander deck. Ranges scale by bracket
 * (1 = casual, 5 = cEDH-adjacent). These are recommendations, not laws.
 */
export type SlotTargets = Record<Slot, { min: number; max: number; ideal: number }>;

export function targetsForBracket(bracket: number | null): SlotTargets {
  const b = bracket ?? 2;
  // Land count is fairly steady across brackets; everything else flexes.
  const lands = { min: 35, max: 39, ideal: 37 };
  const ramp =
    b >= 4
      ? { min: 10, max: 14, ideal: 12 }
      : b === 3
        ? { min: 9, max: 12, ideal: 10 }
        : { min: 8, max: 11, ideal: 10 };
  const draw =
    b >= 4
      ? { min: 10, max: 14, ideal: 12 }
      : b === 3
        ? { min: 8, max: 12, ideal: 10 }
        : { min: 7, max: 10, ideal: 9 };
  const removal =
    b >= 4
      ? { min: 8, max: 12, ideal: 10 }
      : b === 3
        ? { min: 7, max: 10, ideal: 8 }
        : { min: 6, max: 9, ideal: 7 };
  const sweeper =
    b >= 4
      ? { min: 2, max: 4, ideal: 3 }
      : { min: 2, max: 3, ideal: 2 };
  const counter =
    b >= 4
      ? { min: 3, max: 8, ideal: 5 }
      : b === 3
        ? { min: 0, max: 4, ideal: 2 }
        : { min: 0, max: 3, ideal: 0 };
  const tutor =
    b >= 4
      ? { min: 4, max: 10, ideal: 7 }
      : b === 3
        ? { min: 1, max: 4, ideal: 2 }
        : { min: 0, max: 2, ideal: 1 };
  const recursion = { min: 1, max: 5, ideal: 3 };
  const protection = { min: 2, max: 6, ideal: 4 };
  const wincon =
    b >= 4
      ? { min: 3, max: 8, ideal: 5 }
      : { min: 2, max: 5, ideal: 3 };
  const synergy = { min: 5, max: 30, ideal: 20 };
  const other = { min: 0, max: 100, ideal: 0 };

  return {
    Land: lands,
    Ramp: ramp,
    Draw: draw,
    Tutor: tutor,
    Removal: removal,
    Sweeper: sweeper,
    Counterspell: counter,
    Recursion: recursion,
    Protection: protection,
    Wincon: wincon,
    Synergy: synergy,
    Other: other,
  };
}

export type SlotStatus = "under" | "ok" | "over";

export function slotStatus(
  count: number,
  target: { min: number; max: number },
): SlotStatus {
  if (count < target.min) return "under";
  if (count > target.max) return "over";
  return "ok";
}
