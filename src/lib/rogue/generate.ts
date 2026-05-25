/**
 * Multi-pass deck generator — standard (Phase B) and rogue (Phase C).
 *
 * Standard pipeline:
 *   Pass 0 (optional): pick a commander if none given.
 *   Pass 1: LLM generates ~62 nonland cards (temp 0.7).
 *   Pass 2: Deterministic validateDeck(). No LLM.
 *   Pass 3: LLM narrow repair (Haiku, temp 0.4). Loops with Pass 2.
 *   Pass 4: Mechanical manabase + count.
 *   Pass 5: Lean analyzeProposal() — archetype + win cons + gameplan.
 *
 * Rogue pipeline adds (and is otherwise identical):
 *   Pass 1-ROGUE replaces Pass 1: verbalized-sampling ideation. Two calls.
 *     1a) Name consensus, propose 5 theses with unusualness scores, pick
 *         one, articulate a power thesis. Temp 1.0.
 *     1b) Generate ~62 nonlands around the chosen thesis, biased toward
 *         the user's owned-but-rarely-played cards. Temp 1.0.
 *   After compliance + manabase + analyze, four ADVERSARIAL passes run
 *   against the final list, each a SEPARATE LLM call with an objective
 *   independent of the author:
 *     CRITIC: hostile evaluation — name 3 fastest threats at bracket and
 *       walk turn-by-turn, the single most-crippling answer, capability
 *       gaps. Forced concrete and falsifiable.
 *     PREMORTEM: assume 0-4 as a premise, walk back the failure.
 *     TRADE: vs the consensus build, what does this give up + gain.
 *     SYNTHESIS: reconciled verdict. Output schema explicitly allows
 *       "this doesn't hold up" so a talked-down rogue build can ship
 *       honestly. Confidence level: speculative / promising /
 *       questionable / likely_flawed.
 *
 * Critical design rule: the LLM generates and repairs; deterministic code
 * validates. The critique passes' role-separation discipline is the same
 * principle — never ask one call to certify its own thesis.
 */
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { validateDeck, type Violation } from "./validate";

const GEN_MODEL = "claude-sonnet-4-6";
const REPAIR_MODEL = "claude-haiku-4-5-20251001";
const ANALYZE_MODEL = "claude-sonnet-4-6";
const MAX_REPAIR_ITERATIONS = 3;
const TARGET_NONLAND_COUNT = 62;

// ─── Public types ──────────────────────────────────────────────

// inventoryScope governs how the user's collection influences generation:
//   - 'unassigned': bias toward owned cards that aren't currently committed
//     to any deck. Reflects what's actually available to slot in.
//   - 'all_owned': bias toward every owned card, even ones committed to
//     other decks (cannibalize-friendly mode).
//   - 'ignore': don't fetch or surface inventory. Build from the universe
//     of cards as if the collection didn't exist.
export type InventoryScope = "unassigned" | "all_owned" | "ignore";

export type GenerateInput = {
  kind: "standard" | "rogue";
  commanderOracleId?: string;
  archetypeBrief?: string;
  targetBracket: number | null;
  inventoryScope?: InventoryScope;
  /** Optional progress callback. Called once at the START of each
   *  major phase so the caller can persist live progress on the
   *  proposal row (the Builder UI polls and surfaces it). Errors
   *  in the callback are swallowed — progress is best-effort and
   *  must not abort the generation. */
  onProgress?: (phase: GenerationPhase) => Promise<void> | void;
};

/** Surfaceable phase markers, lowest-common-denominator across
 *  standard + rogue pipelines. Mapped one-to-one with the high-level
 *  boundaries in generateDeck(). */
export type GenerationPhase =
  | "pick_commander"
  | "ideate_rogue"
  | "generate"
  | "validate_repair"
  | "manabase"
  | "analyze"
  | "critique";

export type GeneratedCard = {
  oracleId: string;
  name: string;
  role: string;
  rationale: string;
  isLand: boolean;
};

export type DeckAnalysis = {
  archetype: string;
  subArchetype: string | null;
  summary: string;
  winConditions: string[];
  gameplan: { earlyGame: string; midGame: string; lateGame: string };
  weaknesses: string[];
};

export type RogueThesisProposal = {
  name: string;
  description: string;
  unusualnessScore: number;
  offConsensusReason: string;
};

export type RogueRationale = {
  consensusBuild: string;
  departure: string;
  powerThesis: string;
  unusualnessScore: number;
};

export type RogueCritique = {
  counterarguments: string[];
  premortemFailures: string[];
  tradeVerdict: string;
  confidence: "speculative" | "promising" | "questionable" | "likely_flawed";
  confidenceCaveat: string;
};

export type GenerationPass =
  | { name: "pick_commander"; durationMs: number; output: { name: string; rationale: string } }
  | { name: "pass1_generate"; durationMs: number; output: { cards: Array<{ name: string; role: string; rationale: string }>; colorPipTarget: ColorPipTarget; notes?: string } }
  | { name: "pass1_rogue_ideate"; durationMs: number; output: { consensusBuild: string; theses: RogueThesisProposal[]; chosenIndex: number; powerThesis: { underratedClaim: string; specificMechanic: string; whyItCouldWork: string }; unusualnessScore: number } }
  | { name: "pass2_validate"; iteration: number; durationMs: number; output: { violations: Violation[]; isClean: boolean; metrics: unknown } }
  | { name: "pass3_repair"; iteration: number; durationMs: number; output: { replacements: Array<{ remove: string; add: string; role?: string; rationale?: string }> } }
  | { name: "pass4_manabase"; durationMs: number; output: { lands: Array<{ name: string; count: number }>; nonlandCount: number; totalCount: number; flagged?: string[] } }
  | { name: "pass5_analyze"; durationMs: number; output: DeckAnalysis }
  | { name: "pass_critic"; durationMs: number; output: unknown }
  | { name: "pass_premortem"; durationMs: number; output: unknown }
  | { name: "pass_trade"; durationMs: number; output: unknown }
  | { name: "pass_synthesis"; durationMs: number; output: RogueCritique };

export type GenerationLog = {
  startedAt: string;
  endedAt: string;
  model: { generate: string; repair: string; analyze: string };
  passes: GenerationPass[];
  finalViolations: Violation[];
};

export type GenerateResult = {
  commanderOracleId: string;
  cardList: GeneratedCard[];
  analysis: DeckAnalysis;
  rogueRationale?: RogueRationale;
  critique?: RogueCritique;
  log: GenerationLog;
  ok: boolean; // true if final validation is clean
};

type ColorPipTarget = Partial<Record<"W" | "U" | "B" | "R" | "G", number>>;

// ─── Tool schemas ──────────────────────────────────────────────

const PICK_COMMANDER_TOOL: Anthropic.Tool = {
  name: "submit_commander",
  description:
    "Choose a Commander-legal legendary creature whose mechanics and color identity fit the user's playstyle brief. Return the exact printed name plus a one-sentence rationale.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Exact printed card name of the chosen commander.",
      },
      rationale: {
        type: "string",
        description: "One sentence on why this commander fits the brief.",
      },
    },
    required: ["name", "rationale"],
  },
};

const GENERATE_DECK_TOOL: Anthropic.Tool = {
  name: "submit_deck",
  description:
    "Submit the proposed nonland cards plus a color-pip target so the manabase can be computed mechanically.",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        minItems: 55,
        maxItems: 70,
        description:
          "Nonland cards only — about 62. The manabase is computed by code from the color pip target you submit alongside.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Exact printed card name.",
            },
            role: {
              type: "string",
              description:
                "One short tag: ramp / removal / draw / synergy / wincon / interaction / utility.",
            },
            rationale: {
              type: "string",
              description:
                "One sentence on why THIS card with THIS commander, not a generic colors-only fit.",
            },
          },
          required: ["name", "role", "rationale"],
        },
      },
      colorPipTarget: {
        type: "object",
        description:
          "Approximate counts of each color symbol across the nonland mana costs. Used to split the basic lands.",
        properties: {
          W: { type: "number" },
          U: { type: "number" },
          B: { type: "number" },
          R: { type: "number" },
          G: { type: "number" },
        },
      },
      notes: {
        type: "string",
        description: "Optional: any structural notes about the build.",
      },
    },
    required: ["cards", "colorPipTarget"],
  },
};

const REPAIR_TOOL: Anthropic.Tool = {
  name: "submit_repairs",
  description:
    "Submit replacement cards for the slots the validator flagged. Only emit replacements for the listed violations — do not change other cards.",
  input_schema: {
    type: "object",
    properties: {
      replacements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            remove: {
              type: "string",
              description: "Exact name of the violating card to remove.",
            },
            add: {
              type: "string",
              description:
                "Exact name of the replacement card. Must be in the commander's color identity, Commander-legal, and not already in the deck.",
            },
            role: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["remove", "add"],
        },
      },
    },
    required: ["replacements"],
  },
};

const ANALYZE_TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description: "Structured analysis of a Commander deck.",
  input_schema: {
    type: "object",
    properties: {
      archetype: { type: "string" },
      subArchetype: { type: ["string", "null"] },
      summary: { type: "string" },
      winConditions: { type: "array", items: { type: "string" } },
      gameplan: {
        type: "object",
        properties: {
          earlyGame: { type: "string" },
          midGame: { type: "string" },
          lateGame: { type: "string" },
        },
        required: ["earlyGame", "midGame", "lateGame"],
      },
      weaknesses: { type: "array", items: { type: "string" } },
    },
    required: [
      "archetype",
      "subArchetype",
      "summary",
      "winConditions",
      "gameplan",
      "weaknesses",
    ],
  },
};

// ─── Rogue: ideation tool ──────────────────────────────────────

const ROGUE_THESIS_TOOL: Anthropic.Tool = {
  name: "submit_thesis",
  description:
    "Submit the consensus build, five distinct strategic theses, the chosen thesis, and a power-argument for why the chosen direction could win despite being off-meta.",
  input_schema: {
    type: "object",
    properties: {
      consensusBuild: {
        type: "string",
        description:
          "What the consensus / format-typical build of this commander looks like. Be specific — name the archetype and 3-5 cards that everyone runs.",
      },
      theses: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        description:
          "Five distinct strategic theses for this commander, each genuinely off-consensus.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: {
              type: "string",
              description:
                "Two-three sentences on the strategic premise. What does this deck want to do?",
            },
            unusualnessScore: {
              type: "number",
              description: "1 (close to consensus) to 10 (radical departure).",
            },
            offConsensusReason: {
              type: "string",
              description:
                "One sentence: why the format DOESN'T usually build this way.",
            },
          },
          required: [
            "name",
            "description",
            "unusualnessScore",
            "offConsensusReason",
          ],
        },
      },
      chosenIndex: {
        type: "number",
        description:
          "Index 0-4 of the chosen thesis from the five above. Pick the most interesting unusual-but-defensible direction.",
      },
      powerThesis: {
        type: "object",
        description:
          "The argument for why the chosen thesis could be strong DESPITE being uncommon.",
        properties: {
          underratedClaim: {
            type: "string",
            description:
              "What does the format underrate that this deck exploits?",
          },
          specificMechanic: {
            type: "string",
            description:
              "The specific synergy / blind-spot / interaction that makes this work.",
          },
          whyItCouldWork: {
            type: "string",
            description:
              "Concrete reasoning. If you can't articulate a real power argument, the thesis isn't viable — say so and rethink.",
          },
        },
        required: ["underratedClaim", "specificMechanic", "whyItCouldWork"],
      },
    },
    required: ["consensusBuild", "theses", "chosenIndex", "powerThesis"],
  },
};

// ─── Rogue: critique tools ─────────────────────────────────────

const CRITIC_TOOL: Anthropic.Tool = {
  name: "submit_critique",
  description:
    "Submit a hostile evaluation of the deck. Concrete, falsifiable, calibrated to the target bracket.",
  input_schema: {
    type: "object",
    properties: {
      fastestThreats: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description:
          "The three fastest archetypes this deck will face at the target bracket. For each, walk turn-by-turn how that archetype beats this deck before it executes its plan.",
        items: {
          type: "object",
          properties: {
            archetype: { type: "string" },
            turnByTurn: { type: "string" },
          },
          required: ["archetype", "turnByTurn"],
        },
      },
      cripplingAnswer: {
        type: "object",
        description:
          "The single removal / answer / hate card that most cripples this strategy. Calibrate copies-per-pod to the bracket.",
        properties: {
          card: { type: "string" },
          why: { type: "string" },
          podFrequency: {
            type: "string",
            description:
              "How many copies of effects like this appear in a typical pod at the target bracket.",
          },
        },
        required: ["card", "why", "podFrequency"],
      },
      capabilityGaps: {
        type: "array",
        items: { type: "string" },
        description:
          "Things this deck struggles to do that strong decks at this bracket do reliably. Be specific.",
      },
    },
    required: ["fastestThreats", "cripplingAnswer", "capabilityGaps"],
  },
};

const PREMORTEM_TOOL: Anthropic.Tool = {
  name: "submit_premortem",
  description:
    "Forensic analysis of a 0-4 outcome. The failure is asserted as a premise; your job is to explain it.",
  input_schema: {
    type: "object",
    properties: {
      perGameFailures: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        description: "One failure mode per game. Concrete — name cards / lines.",
        items: { type: "string" },
      },
      rootCauses: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        description:
          "Synthesis: 3-5 root causes that better explain the losses than bad luck.",
        items: { type: "string" },
      },
    },
    required: ["perGameFailures", "rootCauses"],
  },
};

const TRADE_TOOL: Anthropic.Tool = {
  name: "submit_trade_verdict",
  description:
    "Explicit comparison vs the consensus build of the same commander.",
  input_schema: {
    type: "object",
    properties: {
      worse: {
        type: "array",
        items: { type: "string" },
        description:
          "Things this deck does WORSE than the consensus, with consequences.",
      },
      better: {
        type: "array",
        items: { type: "string" },
        description: "Specific advantages this deck gains by departing.",
      },
      verdict: {
        type: "string",
        description: "Net assessment: is the upside worth the downside?",
      },
      honestAssessment: {
        type: "string",
        enum: ["upside_clearly_worth_it", "marginal_choice", "consensus_better"],
        description:
          "Most off-meta ideas are off-meta because they're worse. Be honest if that applies.",
      },
    },
    required: ["worse", "better", "verdict", "honestAssessment"],
  },
};

const SYNTHESIS_TOOL: Anthropic.Tool = {
  name: "submit_synthesis",
  description:
    "Reconciled, calibrated verdict on the rogue deck. EXPLICITLY allowed to be negative — 'this doesn't hold up' is a valid output and arguably the system working.",
  input_schema: {
    type: "object",
    properties: {
      counterarguments: {
        type: "array",
        items: { type: "string" },
        description:
          "Strongest surviving attacks from the critic — the ones you can't dismiss.",
      },
      premortemFailures: {
        type: "array",
        items: { type: "string" },
        description: "Most plausible failure modes from the premortem.",
      },
      tradeVerdict: {
        type: "string",
        description:
          "One-sentence verdict on the trade vs consensus.",
      },
      confidence: {
        type: "string",
        enum: ["speculative", "promising", "questionable", "likely_flawed"],
        description:
          "Calibrated confidence. Avoid sycophancy toward the author's thesis. A questionable / likely_flawed verdict is HONEST, not a failure.",
      },
      confidenceCaveat: {
        type: "string",
        description:
          "What has to go right for this deck, or what the actual gamble is. The user reads this to decide if the bet is one they want to make.",
      },
    },
    required: [
      "counterarguments",
      "premortemFailures",
      "tradeVerdict",
      "confidence",
      "confidenceCaveat",
    ],
  },
};

// ─── Anthropic client + helpers ────────────────────────────────

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable the generator.",
    );
  }
  return new Anthropic({ apiKey });
}

export function extractTool<T>(
  response: Anthropic.Message,
  toolName: string,
): T {
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === toolName,
  );
  if (!block) {
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        `Response truncated at the token cap during ${toolName} — try regenerating.`,
      );
    }
    throw new Error(
      `Model did not call ${toolName} (stop_reason: ${response.stop_reason})`,
    );
  }
  return block.input as T;
}

export function bracketDescription(bracket: number | null): string {
  switch (bracket) {
    case 1:
      return "Exhibition — casual jank, no Game Changers, no Mass Land Denial, minimal extra turns.";
    case 2:
      return "Core — precon-level. No Game Changers, no MLD, no extra turns, modest tutors.";
    case 3:
      return "Upgraded — up to 3 Game Changers, up to 2 extra-turn spells, no MLD.";
    case 4:
      return "Optimized — high-power casual. Game Changers/extra turns uncapped, MLD permitted but not encouraged.";
    case 5:
      return "cEDH — tournament-grade. Full power, fast combos, tight interaction.";
    default:
      return "No bracket specified — aim for upgraded/casual (bracket 3).";
  }
}

// ─── Pass 0: pick commander ────────────────────────────────────

async function pickCommander(
  brief: string | undefined,
): Promise<{ name: string; rationale: string }> {
  const prompt = `The user wants to build a Commander deck but hasn't picked a commander. Their playstyle brief:

${brief?.trim() || "(none given — pick whatever you think makes for an interesting build)"}

Choose a legendary creature (or legal planeswalker commander) that fits the brief. Submit via the submit_commander tool with the exact printed name.`;
  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 1024,
    tools: [PICK_COMMANDER_TOOL],
    tool_choice: { type: "tool", name: "submit_commander" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool<{ name: string; rationale: string }>(
    response,
    "submit_commander",
  );
}

async function resolveCommanderByName(name: string): Promise<string | null> {
  const rows = (await db.execute(sql`
    SELECT oracle_id FROM cards
    WHERE lower(name) = lower(${name})
      AND (type_line ILIKE '%Legendary Creature%'
           OR oracle_text ILIKE '%can be your commander%')
    LIMIT 1
  `)) as unknown as Array<{ oracle_id: string }>;
  return rows[0]?.oracle_id ?? null;
}

// ─── Pass 1: generate ──────────────────────────────────────────

type CommanderContext = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string | null;
  colorIdentity: string[];
};

async function fetchCommander(oracleId: string): Promise<CommanderContext> {
  const rows = (await db.execute(sql`
    SELECT oracle_id, name, mana_cost, type_line, oracle_text, color_identity
    FROM cards WHERE oracle_id = ${oracleId} LIMIT 1
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string | null;
    oracle_text: string | null;
    color_identity: string[] | null;
  }>;
  const r = rows[0];
  if (!r) throw new Error(`Commander not found: ${oracleId}`);
  return {
    oracleId: r.oracle_id,
    name: r.name,
    manaCost: r.mana_cost,
    typeLine: r.type_line ?? "",
    oracleText: r.oracle_text,
    colorIdentity: r.color_identity ?? [],
  };
}

async function pass1Generate(
  commander: CommanderContext,
  input: GenerateInput,
  ownedBias: InventoryBiasCard[],
): Promise<{
  cards: Array<{ name: string; role: string; rationale: string }>;
  colorPipTarget: ColorPipTarget;
  notes?: string;
}> {
  const ci = commander.colorIdentity.length > 0
    ? commander.colorIdentity.join("")
    : "C (colorless)";
  // Standard mode treats the owned-cards list as a SOFT hint: prefer them
  // when functionally equivalent, but never sacrifice synergy to use them.
  // This is intentionally less aggressive than rogue's bias.
  const ownedHint =
    ownedBias.length > 0
      ? `\n\nThe user owns these cards already (color-compatible, ${
          input.inventoryScope === "all_owned"
            ? "across all decks"
            : "not currently in any deck"
        }). Prefer them when a functionally equivalent option exists, but do NOT sacrifice synergy to fit them in. They're a tiebreaker, not a requirement:\n${ownedBias
          .slice(0, 50)
          .map((c) => `- ${c.name}`)
          .join("\n")}`
      : "";
  const prompt = `Commander: ${commander.name}
Mana cost: ${commander.manaCost ?? "(no cost listed)"}
Type line: ${commander.typeLine}
Color identity: ${ci}
Oracle text:
${commander.oracleText ?? "(no oracle text)"}

Target bracket: ${input.targetBracket ?? "unspecified"} — ${bracketDescription(input.targetBracket)}

Playstyle brief from the user:
${input.archetypeBrief?.trim() || "(none — build whatever this commander does best)"}${ownedHint}

Generate ${TARGET_NONLAND_COUNT} nonland cards for this Commander deck. Key constraints:

1. Singleton — every nonland card unique. No basics or repeatables in this list; the manabase is added separately.
2. Color identity — EVERY card must be within ${ci || "colorless"}. The validator will reject off-color cards; don't waste a slot.
3. Bracket — ${bracketDescription(input.targetBracket)} Stay within the constraints.
4. COMMANDER-SPECIFIC SYNERGY — this is the most important rule. The deck should feel built around ${commander.name}'s text, not interchangeable with any other deck of the same colors. Reference mechanics that appear in the oracle text. Avoid the generic format-staples greatest-hits pile.

For each card emit: name (exact printed), role (one short tag), and a one-sentence rationale that names the SPECIFIC synergy with ${commander.name}, not just "good card in these colors."

Also submit a color pip target — counts of each color symbol across the nonland mana costs you chose — so the manabase can be computed mechanically.

Submit via submit_deck.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 8192,
    temperature: 0.7,
    tools: [GENERATE_DECK_TOOL],
    tool_choice: { type: "tool", name: "submit_deck" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_deck");
}

// ─── Pass 3: narrow repair ─────────────────────────────────────

async function pass3Repair(
  currentNames: string[],
  violations: Violation[],
  commander: CommanderContext,
  input: GenerateInput,
): Promise<{
  replacements: Array<{
    remove: string;
    add: string;
    role?: string;
    rationale?: string;
  }>;
}> {
  const ci = commander.colorIdentity.length > 0
    ? commander.colorIdentity.join("")
    : "C (colorless)";
  const violationList = violations
    .map((v) => `- ${v.cardName}: ${v.type} — ${v.detail}`)
    .join("\n");
  const prompt = `You generated a Commander deck for ${commander.name} (color identity ${ci}, target bracket ${input.targetBracket ?? "—"}) but the deterministic validator found these violations:

${violationList}

Current decklist (nonland cards):
${currentNames.join(", ")}

Fix EXACTLY these violations. For each, emit { remove: violating card, add: replacement }. Constraints on every replacement:

- Must be in commander's color identity (${ci || "colorless"}).
- Must be Commander-legal (not banned).
- Must not already be in the deck.
- Must respect the current bracket: ${bracketDescription(input.targetBracket)}
- Don't reintroduce a violation you just fixed.
- Prefer a card with the same role as the one being removed.

Do not change other cards. Submit via submit_repairs.`;

  const response = await client().messages.create({
    model: REPAIR_MODEL,
    max_tokens: 2048,
    temperature: 0.4,
    tools: [REPAIR_TOOL],
    tool_choice: { type: "tool", name: "submit_repairs" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_repairs");
}

// ─── Pass 4: manabase ──────────────────────────────────────────

const BASIC_FOR_COLOR: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

/**
 * Mechanical manabase computation. Total land count adjusts for the deck's
 * average mana value: low curve = 36, mid = 37, high = 38. Basics are
 * distributed proportionally to the color pip target the model returned.
 * Mono and colorless cases short-circuit to the obvious answer.
 *
 * Phase B keeps this deliberately simple — no fetchlands, shocklands, or
 * triomes detection. Saving those refinements for later means the verify
 * pass can hand-check the math without Scryfall lookups.
 */
export function computeManabase(input: {
  colorIdentity: string[];
  colorPipTarget: ColorPipTarget;
  nonlandAvgCmc: number;
}): { lands: Array<{ name: string; count: number }>; totalLands: number } {
  const colors = input.colorIdentity.filter((c) => c in BASIC_FOR_COLOR);

  // Curve-aware land count. Bands match the standard Commander heuristic.
  let totalLands = 37;
  if (input.nonlandAvgCmc < 2.5) totalLands = 36;
  else if (input.nonlandAvgCmc >= 3.5) totalLands = 38;

  // Colorless commander (Karn, Kozilek) → Wastes.
  if (colors.length === 0) {
    return {
      lands: [{ name: "Wastes", count: totalLands }],
      totalLands,
    };
  }

  // Mono → all basic of that color.
  if (colors.length === 1) {
    const c = colors[0];
    return {
      lands: [{ name: BASIC_FOR_COLOR[c], count: totalLands }],
      totalLands,
    };
  }

  // Multicolor: distribute proportionally to pip counts. If the model gave
  // us no pip counts (or zero everywhere), fall back to an even split.
  const pips: Record<string, number> = {};
  let pipSum = 0;
  for (const c of colors) {
    const v = input.colorPipTarget[c as keyof ColorPipTarget] ?? 0;
    pips[c] = v;
    pipSum += v;
  }
  if (pipSum === 0) {
    for (const c of colors) {
      pips[c] = 1;
      pipSum += 1;
    }
  }

  const lands: Array<{ name: string; count: number }> = [];
  let assigned = 0;
  for (const c of colors) {
    const share = Math.floor((pips[c] / pipSum) * totalLands);
    if (share > 0) {
      lands.push({ name: BASIC_FOR_COLOR[c], count: share });
      assigned += share;
    }
  }
  // Distribute any rounding slack to the color with the highest pip share.
  if (assigned < totalLands) {
    const remainder = totalLands - assigned;
    const top = [...colors].sort((a, b) => pips[b] - pips[a])[0];
    const existing = lands.find((l) => l.name === BASIC_FOR_COLOR[top]);
    if (existing) existing.count += remainder;
    else lands.push({ name: BASIC_FOR_COLOR[top], count: remainder });
  }
  return { lands, totalLands };
}

async function computeAvgCmc(cardNames: string[]): Promise<number> {
  if (cardNames.length === 0) return 0;
  const rows = (await db.execute(sql`
    SELECT AVG(cmc::numeric)::numeric(10,2) AS avg_cmc
    FROM cards
    WHERE lower(name) = ANY(ARRAY[${sql.join(
      cardNames.map((n) => sql`lower(${n})`),
      sql`, `,
    )}])
      AND cmc IS NOT NULL
  `)) as unknown as Array<{ avg_cmc: string | null }>;
  const v = rows[0]?.avg_cmc;
  return v ? Number.parseFloat(v) : 3;
}

// ─── Pass 5: analyze ───────────────────────────────────────────

async function pass5Analyze(
  commander: CommanderContext,
  cardNames: string[],
  targetBracket: number | null,
): Promise<DeckAnalysis> {
  const prompt = `Analyze this Commander deck:

Commander: ${commander.name}
Color identity: ${commander.colorIdentity.join("") || "colorless"}
Target bracket: ${targetBracket ?? "—"}

Decklist (nonlands):
${cardNames.join(", ")}

Submit a structured analysis via submit_analysis covering:
- archetype + sub-archetype if there's a clear secondary plan
- one-paragraph summary
- 2-4 win conditions, named specifically
- gameplan in three phases (early / mid / late) — 1-2 sentences each, concrete actions
- 3-5 weaknesses or matchups the deck struggles against

Be specific and honest. Avoid generic phrases like "this deck has good ramp."`;

  const response = await client().messages.create({
    model: ANALYZE_MODEL,
    max_tokens: 4096,
    tools: [ANALYZE_TOOL],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool<DeckAnalysis>(response, "submit_analysis");
}

// ─── Rogue ideation: owned-but-rarely-played inventory bias ─────

type InventoryBiasCard = {
  oracleId: string;
  name: string;
  typeLine: string | null;
  manaCost: string | null;
  edhrecRank: number | null;
};

/**
 * Owned cards relevant to a generation, scoped by InventoryScope.
 *
 * - 'unassigned' (rogue default): owned cards NOT currently in any deck.
 *   Reflects what's literally available to slot into a new build. Sorted
 *   by edhrec_rank DESC so the most-obscure surface first — the "obscure
 *   but already paid for" personal-relevance edge.
 * - 'all_owned': every owned card in the commander's color identity,
 *   regardless of deck commitments. Cannibalize-friendly: gives the model
 *   permission to suggest cards currently in another deck.
 * - 'ignore': returns []. Caller skips the bias entirely.
 *
 * Always excludes basic lands (the manabase is computed mechanically) and
 * non-Commander-legal cards.
 */
async function fetchInventoryBias(
  scope: InventoryScope,
  colorIdentity: string[],
  limit = 60,
): Promise<InventoryBiasCard[]> {
  if (scope === "ignore") return [];
  const ciExpr = colorIdentity.length > 0
    ? sql`AND COALESCE(c.color_identity, ARRAY[]::text[]) <@ ARRAY[${sql.join(
        colorIdentity.map((x) => sql`${x}`),
        sql`, `,
      )}]::text[]`
    : sql`AND (c.color_identity IS NULL OR array_length(c.color_identity, 1) IS NULL)`;
  // 'unassigned' joins to deck_commitments and excludes anything with a
  // commit; 'all_owned' skips that join.
  const commitmentFilter =
    scope === "unassigned"
      ? sql`AND NOT EXISTS (
          SELECT 1 FROM deck_commitments dc WHERE dc.oracle_id = c.oracle_id
        )`
      : sql``;
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id, c.name, c.type_line, c.mana_cost, c.edhrec_rank
    FROM cards c
    INNER JOIN oracle_ownership o ON o.oracle_id = c.oracle_id
    WHERE o.owned_count > 0
      AND c.is_commander_legal = TRUE
      ${ciExpr}
      ${commitmentFilter}
      AND NOT (c.type_line ILIKE '%Basic Land%')
    ORDER BY c.edhrec_rank DESC NULLS LAST
    LIMIT ${limit}
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    type_line: string | null;
    mana_cost: string | null;
    edhrec_rank: number | null;
  }>;
  return rows.map((r) => ({
    oracleId: r.oracle_id,
    name: r.name,
    typeLine: r.type_line,
    manaCost: r.mana_cost,
    edhrecRank: r.edhrec_rank,
  }));
}

// ─── Pass 1-Rogue: verbalized sampling + biased generation ─────

async function pass1RogueIdeate(
  commander: CommanderContext,
  input: GenerateInput,
): Promise<{
  consensusBuild: string;
  theses: RogueThesisProposal[];
  chosenIndex: number;
  powerThesis: {
    underratedClaim: string;
    specificMechanic: string;
    whyItCouldWork: string;
  };
  unusualnessScore: number;
}> {
  const ci = commander.colorIdentity.length > 0
    ? commander.colorIdentity.join("")
    : "C (colorless)";

  const prompt = `You are designing a ROGUE Commander deck — explicitly off-meta, high-variance, willing to be wrong if it's interesting.

Commander: ${commander.name}
Mana cost: ${commander.manaCost ?? "—"}
Type line: ${commander.typeLine}
Color identity: ${ci}
Oracle text:
${commander.oracleText ?? "(no oracle text)"}

Target bracket: ${input.targetBracket ?? "unspecified"} — ${bracketDescription(input.targetBracket)}

Playstyle brief from the user:
${input.archetypeBrief?.trim() || "(none — explore unusual but defensible directions)"}

Verbalized sampling. Do NOT propose "the best deck." Instead:

1. Name the CONSENSUS build of this commander — the standard archetype most players go for. Be specific. Name 3-5 cards everyone runs.

2. Propose FIVE genuinely distinct strategic theses, each off-consensus. Rate each by unusualnessScore (1 = close to consensus, 10 = radical). For each, explicitly state the reason it's NOT the usual build.

3. Pick ONE thesis as the chosen direction. Pick the most interesting unusual-but-defensible one — not the most extreme, not the safest.

4. Articulate a POWER THESIS for the chosen direction: what does the format underrate that this deck exploits? What is the specific synergy / blind-spot / interaction that makes it potentially strong DESPITE being uncommon? If you can't articulate a real power argument, the thesis isn't viable — say so and reconsider. A thesis without a power argument is a quality-gate cut.

Submit via submit_thesis.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 4096,
    temperature: 1.0,
    tools: [ROGUE_THESIS_TOOL],
    tool_choice: { type: "tool", name: "submit_thesis" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_thesis");
}

async function pass1RogueGenerate(
  commander: CommanderContext,
  input: GenerateInput,
  thesis: {
    consensusBuild: string;
    chosenThesis: RogueThesisProposal;
    powerThesis: {
      underratedClaim: string;
      specificMechanic: string;
      whyItCouldWork: string;
    };
  },
  ownedRarelyPlayed: InventoryBiasCard[],
): Promise<{
  cards: Array<{ name: string; role: string; rationale: string }>;
  colorPipTarget: ColorPipTarget;
  notes?: string;
}> {
  const ci = commander.colorIdentity.length > 0
    ? commander.colorIdentity.join("")
    : "C (colorless)";

  // Cap the printed list to avoid blowing past token limits while still
  // giving the model real personal-relevance signal.
  const ownedList = ownedRarelyPlayed
    .slice(0, 60)
    .map(
      (c) =>
        `- ${c.name}${c.manaCost ? ` ${c.manaCost}` : ""}${c.typeLine ? ` — ${c.typeLine}` : ""}${c.edhrecRank ? ` (EDHREC #${c.edhrecRank})` : ""}`,
    )
    .join("\n");

  const prompt = `Generate the nonland cards for this rogue Commander deck.

Commander: ${commander.name}
Color identity: ${ci}
Target bracket: ${input.targetBracket ?? "unspecified"} — ${bracketDescription(input.targetBracket)}

CHOSEN THESIS (unusualness ${thesis.chosenThesis.unusualnessScore}/10):
${thesis.chosenThesis.name}: ${thesis.chosenThesis.description}

Why this departs from consensus: ${thesis.chosenThesis.offConsensusReason}

POWER THESIS:
- Underrated claim: ${thesis.powerThesis.underratedClaim}
- Specific mechanic: ${thesis.powerThesis.specificMechanic}
- Why it could work: ${thesis.powerThesis.whyItCouldWork}

INVENTORY BIAS — the user's owned-but-rarely-played cards (color-compatible, not in any existing deck, sorted by EDHREC rank descending — the format considers these obscure). PREFER configurations that exploit these. Personal relevance + novelty + a card already paid for is the unique-to-us advantage:

${ownedList || "(no owned-but-unused cards found)"}

Generate ${TARGET_NONLAND_COUNT} nonland cards. Constraints:
1. Singleton — every nonland unique.
2. Color identity — every card within ${ci || "colorless"}.
3. Bracket — ${bracketDescription(input.targetBracket)}
4. COMMIT to the chosen thesis. Don't drift back to consensus. If the thesis is "self-mill voltron," don't sneak in standard ramp staples that have nothing to do with the plan.
5. Where defensible, prefer cards from the inventory-bias list.

For each card: name (exact printed), role (short tag), and rationale that names the SPECIFIC synergy with the thesis, not just "good card in these colors."

Also submit a color pip target for mechanical manabase computation.

Submit via submit_deck.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 8192,
    temperature: 1.0,
    tools: [GENERATE_DECK_TOOL],
    tool_choice: { type: "tool", name: "submit_deck" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_deck");
}

// ─── Critique passes (each independent) ────────────────────────

async function passCritic(
  commander: CommanderContext,
  finalCardNames: string[],
  targetBracket: number | null,
): Promise<unknown> {
  // Independent evaluator — NO knowledge it's supposed to like the deck or
  // that there's an author with a thesis. Hostile by role assignment.
  const prompt = `You are evaluating a Commander deck. You don't know who built it. You don't know what they were trying to do. Your job is to find why this deck LOSES.

Bracket: ${targetBracket ?? "—"} — ${bracketDescription(targetBracket)}. The deck will be played at bracket ${targetBracket ?? "3"} pods. Calibrate your critique to that level. A deck that loses to a turn-3 cEDH combo is irrelevant if it's never seeing one.

Commander: ${commander.name}
Color identity: ${commander.colorIdentity.join("") || "colorless"}
Decklist (final, including lands):
${finalCardNames.join(", ")}

Find concrete, falsifiable problems. Submit via submit_critique with:
- fastestThreats: the 3 fastest archetypes at this bracket, with turn-by-turn lines for each
- cripplingAnswer: the single most-crippling removal/answer + pod-frequency at this bracket
- capabilityGaps: what this deck struggles to do that strong decks at this bracket do reliably

Name specific decks. Name specific cards. No "this deck is too slow" without saying compared to what.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 3072,
    temperature: 0.5,
    tools: [CRITIC_TOOL],
    tool_choice: { type: "tool", name: "submit_critique" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_critique");
}

async function passPremortem(
  commander: CommanderContext,
  finalCardNames: string[],
  targetBracket: number | null,
): Promise<unknown> {
  // The failure is asserted as a PREMISE — not "could this lose," but "it
  // already lost, walk back why." Defeats optimism bias structurally.
  const prompt = `This Commander deck went 0-4 at a four-pod table. Walk back the most likely reasons.

The failure is a premise. Don't ask "would it lose" — assume it did. Your job is forensic.

Commander: ${commander.name}
Bracket: ${targetBracket ?? "—"} — ${bracketDescription(targetBracket)}
Decklist:
${finalCardNames.join(", ")}

Submit via submit_premortem with:
- perGameFailures: one plausible failure mode per game (4 entries). Concrete — name cards or game lines.
- rootCauses: 3-5 root causes that explain the losses better than bad luck.

No "it ran out of cards" — give me specific failure mechanics.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 2048,
    temperature: 0.5,
    tools: [PREMORTEM_TOOL],
    tool_choice: { type: "tool", name: "submit_premortem" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_premortem");
}

async function passTrade(
  commander: CommanderContext,
  finalCardNames: string[],
  targetBracket: number | null,
  consensusBuild: string,
): Promise<unknown> {
  // Forced explicit comparison to the strong known build. Most off-meta
  // ideas ARE worse than consensus — surface that honestly.
  const prompt = `Compare this Commander deck explicitly to the CONSENSUS build of ${commander.name}.

Consensus build (as identified independently): ${consensusBuild}

This deck (the off-meta departure):
${finalCardNames.join(", ")}

Bracket: ${targetBracket ?? "—"}

Most off-meta ideas are off-meta because they're worse. Be honest if that applies here. Submit via submit_trade_verdict with:
- worse: things this deck does WORSE than the consensus, with consequences (not just card differences)
- better: specific advantages this deck gains by departing
- verdict: net assessment in 1-2 sentences
- honestAssessment: upside_clearly_worth_it / marginal_choice / consensus_better

If the answer is "consensus_better," say so. The user wants honest comparison, not flattery.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 2048,
    temperature: 0.5,
    tools: [TRADE_TOOL],
    tool_choice: { type: "tool", name: "submit_trade_verdict" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool(response, "submit_trade_verdict");
}

async function passSynthesis(
  commander: CommanderContext,
  finalCardNames: string[],
  targetBracket: number | null,
  powerThesis: {
    underratedClaim: string;
    specificMechanic: string;
    whyItCouldWork: string;
  },
  critic: unknown,
  premortem: unknown,
  trade: unknown,
): Promise<RogueCritique> {
  // Synthesis call. Has access to the power thesis AND all three critiques,
  // and is explicitly told a negative verdict is honest, not a failure.
  // The output schema enforces that — confidence enum includes
  // questionable + likely_flawed as valid endpoints.
  const prompt = `You're synthesizing three independent critiques of a Commander deck into a calibrated final verdict.

Commander: ${commander.name}
Bracket: ${targetBracket ?? "—"}

THE AUTHOR'S POWER THESIS:
- Underrated claim: ${powerThesis.underratedClaim}
- Specific mechanic: ${powerThesis.specificMechanic}
- Why it could work: ${powerThesis.whyItCouldWork}

INDEPENDENT CRITIC (hostile evaluation):
${JSON.stringify(critic, null, 2)}

INDEPENDENT PREMORTEM (assumed-failure walkback):
${JSON.stringify(premortem, null, 2)}

INDEPENDENT TRADE VERDICT (vs consensus build):
${JSON.stringify(trade, null, 2)}

Final list:
${finalCardNames.join(", ")}

Synthesize honestly. The author was bullish — they were trying to make this deck work. The three critics are independent. Your job is calibrated truth, not consensus-by-averaging.

CRITICAL: your output is EXPLICITLY ALLOWED to say "this doesn't hold up." A talked-down rogue verdict is the system WORKING, not a failure mode. Don't be hand-wavy positive. Don't reflexively defend the author's thesis. If the critic and premortem and trade all converge on "this is worse than the consensus build for unclear gain," say so.

Avoid: "good deck with some interesting choices." Be specific.

Submit via submit_synthesis with:
- counterarguments: 2-4 surviving attacks from the critic — the ones you couldn't dismiss
- premortemFailures: 2-4 plausible failure modes from the premortem
- tradeVerdict: 1-2 sentence verdict on the trade vs consensus
- confidence: speculative / promising / questionable / likely_flawed
- confidenceCaveat: what HAS to go right for this deck, or what the actual gamble is. The user reads this to decide whether the bet is one they want to make.`;

  const response = await client().messages.create({
    model: GEN_MODEL,
    max_tokens: 3072,
    temperature: 0.5,
    tools: [SYNTHESIS_TOOL],
    tool_choice: { type: "tool", name: "submit_synthesis" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractTool<RogueCritique>(response, "submit_synthesis");
}

// ─── Orchestrator ──────────────────────────────────────────────

export async function generateDeck(
  input: GenerateInput,
): Promise<GenerateResult> {
  const startedAt = new Date().toISOString();
  const passes: GenerationPass[] = [];

  // Best-effort progress notify. The caller wires this up to UPDATE
  // the proposal row's generationLog with the current phase so the
  // Builder UI can show "we're at validate_repair / 1 of 5" while
  // generation is still in flight. Errors here are swallowed — a
  // failed progress write must never abort the LLM pipeline.
  const notify = async (phase: GenerationPhase) => {
    if (!input.onProgress) return;
    try {
      await input.onProgress(phase);
    } catch {
      /* ignore */
    }
  };

  // Pass 0: pick commander if not given.
  let commanderOracleId = input.commanderOracleId ?? null;
  if (!commanderOracleId) {
    await notify("pick_commander");
    const t0 = Date.now();
    const picked = await pickCommander(input.archetypeBrief);
    passes.push({
      name: "pick_commander",
      durationMs: Date.now() - t0,
      output: picked,
    });
    commanderOracleId = await resolveCommanderByName(picked.name);
    if (!commanderOracleId) {
      throw new Error(
        `Picked commander "${picked.name}" not found in the card database. Retry with a manual commander selection.`,
      );
    }
  }

  const commander = await fetchCommander(commanderOracleId);

  // Pass 1: generate. For 'rogue' kind, do verbalized-sampling ideation
  // first (consensus + 5 theses + power thesis) and bias generation toward
  // owned-but-rarely-played cards.
  let rogueIdeation:
    | (Awaited<ReturnType<typeof pass1RogueIdeate>> & {
        chosenThesis: RogueThesisProposal;
      })
    | null = null;
  let gen: {
    cards: Array<{ name: string; role: string; rationale: string }>;
    colorPipTarget: ColorPipTarget;
    notes?: string;
  };

  if (input.kind === "rogue") {
    await notify("ideate_rogue");
    const tIdeate = Date.now();
    const ideation = await pass1RogueIdeate(commander, input);
    rogueIdeation = {
      ...ideation,
      chosenThesis: ideation.theses[ideation.chosenIndex],
    };
    passes.push({
      name: "pass1_rogue_ideate",
      durationMs: Date.now() - tIdeate,
      output: ideation,
    });
    // Rogue defaults to 'unassigned' if the caller doesn't specify — that's
    // the historical behavior and the most useful for a personal tool.
    const scope: InventoryScope = input.inventoryScope ?? "unassigned";
    const ownedBias = await fetchInventoryBias(scope, commander.colorIdentity);
    await notify("generate");
    const tGen = Date.now();
    gen = await pass1RogueGenerate(
      commander,
      input,
      {
        consensusBuild: ideation.consensusBuild,
        chosenThesis: rogueIdeation.chosenThesis,
        powerThesis: ideation.powerThesis,
      },
      ownedBias,
    );
    passes.push({
      name: "pass1_generate",
      durationMs: Date.now() - tGen,
      output: gen,
    });
  } else {
    // Standard mode: still fetch inventory bias if the scope allows.
    // Default for standard is 'unassigned' (helpful but unobtrusive).
    const scope: InventoryScope = input.inventoryScope ?? "unassigned";
    const ownedBias = await fetchInventoryBias(scope, commander.colorIdentity);
    await notify("generate");
    const t1 = Date.now();
    gen = await pass1Generate(commander, input, ownedBias);
    passes.push({
      name: "pass1_generate",
      durationMs: Date.now() - t1,
      output: gen,
    });
  }

  const currentNames = gen.cards.map((c) => c.name);
  const roleByName = new Map(gen.cards.map((c) => [c.name, c]));

  // Passes 2 + 3 loop.
  await notify("validate_repair");
  let finalValidation = await validateDeckLoose(
    currentNames,
    commanderOracleId,
    input.targetBracket,
  );
  passes.push({
    name: "pass2_validate",
    iteration: 0,
    durationMs: 0,
    output: {
      violations: finalValidation.violations,
      isClean: finalValidation.isClean,
      metrics: finalValidation.metrics,
    },
  });

  for (let iter = 1; iter <= MAX_REPAIR_ITERATIONS; iter++) {
    // Repair only addresses the resolvable-card-level violations:
    // unresolved, off_color, illegal, duplicate_nonbasic,
    // gamechanger_over_bracket, mld_over_bracket, extra_turns_over_bracket.
    // wrong_count is handled by Pass 4 and not part of the repair loop.
    const repairable = finalValidation.violations.filter(
      (v) => v.type !== "wrong_count",
    );
    if (repairable.length === 0) break;

    const tRepair = Date.now();
    const repair = await pass3Repair(currentNames, repairable, commander, input);
    passes.push({
      name: "pass3_repair",
      iteration: iter,
      durationMs: Date.now() - tRepair,
      output: repair,
    });
    for (const r of repair.replacements) {
      const idx = currentNames.findIndex(
        (n) => n.toLowerCase() === r.remove.toLowerCase(),
      );
      if (idx >= 0) {
        currentNames[idx] = r.add;
        if (r.role || r.rationale) {
          roleByName.set(r.add, {
            name: r.add,
            role: r.role ?? roleByName.get(r.remove)?.role ?? "synergy",
            rationale:
              r.rationale ?? roleByName.get(r.remove)?.rationale ?? "",
          });
        }
        roleByName.delete(r.remove);
      }
    }
    const tV = Date.now();
    finalValidation = await validateDeckLoose(
      currentNames,
      commanderOracleId,
      input.targetBracket,
    );
    passes.push({
      name: "pass2_validate",
      iteration: iter,
      durationMs: Date.now() - tV,
      output: {
        violations: finalValidation.violations,
        isClean: finalValidation.isClean,
        metrics: finalValidation.metrics,
      },
    });
    if (finalValidation.violations.filter((v) => v.type !== "wrong_count").length === 0) {
      break;
    }
  }

  // Pass 4: manabase + count.
  await notify("manabase");
  const t4 = Date.now();
  const avgCmc = await computeAvgCmc(currentNames);
  const manabase = computeManabase({
    colorIdentity: commander.colorIdentity,
    colorPipTarget: gen.colorPipTarget,
    nonlandAvgCmc: avgCmc,
  });
  const nonlandCount = currentNames.length;
  const totalCount = nonlandCount + manabase.totalLands;
  const flagged: string[] = [];
  if (totalCount !== 99 && totalCount !== 98) {
    flagged.push(
      `Total cards = ${totalCount} (need 99, or 98 with partner). Land count ${manabase.totalLands}, nonland ${nonlandCount}.`,
    );
  }
  passes.push({
    name: "pass4_manabase",
    durationMs: Date.now() - t4,
    output: {
      lands: manabase.lands,
      nonlandCount,
      totalCount,
      flagged: flagged.length > 0 ? flagged : undefined,
    },
  });

  // Pass 5: analyze.
  await notify("analyze");
  const t5 = Date.now();
  const allCardNames = [
    ...currentNames,
    ...manabase.lands.flatMap((l) =>
      Array.from({ length: l.count }, () => l.name),
    ),
  ];
  const analysis = await pass5Analyze(
    commander,
    currentNames,
    input.targetBracket,
  );
  passes.push({
    name: "pass5_analyze",
    durationMs: Date.now() - t5,
    output: analysis,
  });

  // Resolve every card name → oracle id for the final card list.
  const resolvedRows = (await db.execute(sql`
    SELECT oracle_id, name, type_line
    FROM cards
    WHERE lower(name) = ANY(ARRAY[${sql.join(
      [...new Set(allCardNames.map((n) => n.toLowerCase()))].map(
        (n) => sql`${n}`,
      ),
      sql`, `,
    )}])
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    type_line: string | null;
  }>;
  const oracleByLower = new Map(
    resolvedRows.map((r) => [r.name.toLowerCase(), r]),
  );

  const cardList: GeneratedCard[] = allCardNames
    .map((name) => {
      const row = oracleByLower.get(name.toLowerCase());
      if (!row) return null;
      const meta = roleByName.get(name);
      const isLand =
        /\bLand\b/i.test(row.type_line ?? "") ||
        /Basic Land/i.test(row.type_line ?? "");
      return {
        oracleId: row.oracle_id,
        name: row.name,
        role: meta?.role ?? (isLand ? "land" : "synergy"),
        rationale: meta?.rationale ?? "",
        isLand,
      };
    })
    .filter((c): c is GeneratedCard => c !== null);

  // Rogue critique passes — run AFTER compliance + manabase + analyze, on
  // the FINAL list. Each pass is a separate LLM call with role separation;
  // skepticism comes from independent objectives, not from asking one call
  // to be self-critical.
  let rogueRationale: RogueRationale | undefined;
  let critique: RogueCritique | undefined;
  if (input.kind === "rogue" && rogueIdeation) {
    await notify("critique");
    const finalNamesForCritique = cardList.map((c) => c.name);

    const tCritic = Date.now();
    const criticOut = await passCritic(
      commander,
      finalNamesForCritique,
      input.targetBracket,
    );
    passes.push({
      name: "pass_critic",
      durationMs: Date.now() - tCritic,
      output: criticOut,
    });

    const tPremortem = Date.now();
    const premortemOut = await passPremortem(
      commander,
      finalNamesForCritique,
      input.targetBracket,
    );
    passes.push({
      name: "pass_premortem",
      durationMs: Date.now() - tPremortem,
      output: premortemOut,
    });

    const tTrade = Date.now();
    const tradeOut = await passTrade(
      commander,
      finalNamesForCritique,
      input.targetBracket,
      rogueIdeation.consensusBuild,
    );
    passes.push({
      name: "pass_trade",
      durationMs: Date.now() - tTrade,
      output: tradeOut,
    });

    const tSynth = Date.now();
    critique = await passSynthesis(
      commander,
      finalNamesForCritique,
      input.targetBracket,
      rogueIdeation.powerThesis,
      criticOut,
      premortemOut,
      tradeOut,
    );
    passes.push({
      name: "pass_synthesis",
      durationMs: Date.now() - tSynth,
      output: critique,
    });

    rogueRationale = {
      consensusBuild: rogueIdeation.consensusBuild,
      departure: rogueIdeation.chosenThesis.description,
      powerThesis: rogueIdeation.powerThesis.whyItCouldWork,
      unusualnessScore: rogueIdeation.chosenThesis.unusualnessScore,
    };
  }

  return {
    commanderOracleId,
    cardList,
    analysis,
    rogueRationale,
    critique,
    log: {
      startedAt,
      endedAt: new Date().toISOString(),
      model: {
        generate: GEN_MODEL,
        repair: REPAIR_MODEL,
        analyze: ANALYZE_MODEL,
      },
      passes,
      finalViolations: finalValidation.violations,
    },
    ok: finalValidation.violations.filter((v) => v.type !== "wrong_count")
      .length === 0,
  };
}

// validateDeck enforces a 99-or-98 total card count, but during the repair
// loop we're only validating the nonland slice. This wrapper drops the
// wrong_count violation noise from the loop iterations; Pass 4 owns the
// final count check.
async function validateDeckLoose(
  cardNames: string[],
  commanderOracleId: string,
  targetBracket: number | null,
) {
  const v = await validateDeck(cardNames, commanderOracleId, targetBracket);
  return {
    ...v,
    violations: v.violations.filter((vv) => vv.type !== "wrong_count"),
    isClean: v.violations.filter((vv) => vv.type !== "wrong_count").length === 0,
  };
}
