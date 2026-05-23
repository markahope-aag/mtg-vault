/**
 * Phase B: standard multi-pass deck generator.
 *
 * Pipeline:
 *   Pass 0 (optional): pick a commander if none given.
 *   Pass 1: LLM generates ~62 nonland cards with roles + rationales + a
 *           color-pip target. Sonnet, temp 0.7, tool-use structured output.
 *   Pass 2: Deterministic validateDeck() from A4. No LLM.
 *   Pass 3: LLM narrow repair. Haiku, temp 0.4. Loops with Pass 2; max 3
 *           iterations. Remaining violations after the loop are surfaced
 *           rather than allowed to ship broken or loop forever.
 *   Pass 4: Mechanical manabase + structural completion (code only). Lands
 *           split by color pip ratio; total adjusted for curve.
 *   Pass 5: Lean analyzeProposal() — archetype + win cons + 3-phase gameplan
 *           + weaknesses. Doesn't reuse strategy.ts's analyzeDeck because
 *           that one expects a DeckDetail with inventory context; this runs
 *           on a fresh proposal before save.
 *
 * Critical design rule from the spec: the LLM generates and repairs;
 * deterministic code validates. validateDeck is the single source of truth
 * for "is this legal" — the model never certifies its own compliance.
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

export type GenerateInput = {
  kind: "standard" | "rogue";
  commanderOracleId?: string;
  archetypeBrief?: string;
  targetBracket: number | null;
};

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

export type GenerationPass =
  | { name: "pick_commander"; durationMs: number; output: { name: string; rationale: string } }
  | { name: "pass1_generate"; durationMs: number; output: { cards: Array<{ name: string; role: string; rationale: string }>; colorPipTarget: ColorPipTarget; notes?: string } }
  | { name: "pass2_validate"; iteration: number; durationMs: number; output: { violations: Violation[]; isClean: boolean; metrics: unknown } }
  | { name: "pass3_repair"; iteration: number; durationMs: number; output: { replacements: Array<{ remove: string; add: string; role?: string; rationale?: string }> } }
  | { name: "pass4_manabase"; durationMs: number; output: { lands: Array<{ name: string; count: number }>; nonlandCount: number; totalCount: number; flagged?: string[] } }
  | { name: "pass5_analyze"; durationMs: number; output: DeckAnalysis };

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

function extractTool<T>(
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

function bracketDescription(bracket: number | null): string {
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
): Promise<{
  cards: Array<{ name: string; role: string; rationale: string }>;
  colorPipTarget: ColorPipTarget;
  notes?: string;
}> {
  const ci = commander.colorIdentity.length > 0
    ? commander.colorIdentity.join("")
    : "C (colorless)";
  const prompt = `Commander: ${commander.name}
Mana cost: ${commander.manaCost ?? "(no cost listed)"}
Type line: ${commander.typeLine}
Color identity: ${ci}
Oracle text:
${commander.oracleText ?? "(no oracle text)"}

Target bracket: ${input.targetBracket ?? "unspecified"} — ${bracketDescription(input.targetBracket)}

Playstyle brief from the user:
${input.archetypeBrief?.trim() || "(none — build whatever this commander does best)"}

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

// ─── Orchestrator ──────────────────────────────────────────────

export async function generateDeck(
  input: GenerateInput,
): Promise<GenerateResult> {
  const startedAt = new Date().toISOString();
  const passes: GenerationPass[] = [];

  // Pass 0: pick commander if not given.
  let commanderOracleId = input.commanderOracleId ?? null;
  if (!commanderOracleId) {
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

  // Pass 1: generate.
  const t1 = Date.now();
  const gen = await pass1Generate(commander, input);
  passes.push({
    name: "pass1_generate",
    durationMs: Date.now() - t1,
    output: gen,
  });
  const currentNames = gen.cards.map((c) => c.name);
  const roleByName = new Map(gen.cards.map((c) => [c.name, c]));

  // Passes 2 + 3 loop.
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

  return {
    commanderOracleId,
    cardList,
    analysis,
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
