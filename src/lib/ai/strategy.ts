/**
 * Deck strategy advisor — sends a deck list and an inventory candidate
 * list to Claude Sonnet 4.6 and returns structured analysis covering
 * archetype, win conditions, gameplan, weaknesses, and suggested
 * improvements drawn exclusively from the user's owned cards.
 *
 * Design notes:
 * - Structured JSON is enforced via Anthropic's tool-use, not free text.
 * - Inventory candidates are pre-filtered to the deck's color identity
 *   and Commander-legal cards the user already owns, capped at 150 rows
 *   to stay within reasonable token cost.
 * - A deck "signature" (sha256 of sorted printing ids) is recorded with
 *   each analysis so the UI can flag staleness when the decklist drifts.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { sqlArray } from "@/lib/sql";
import { db } from "@/db/client";
import { cards, deckCards, decks, printings } from "@/db/schema";
import type { DeckDetail } from "@/lib/decks/types";

export const STRATEGY_MODEL = "claude-sonnet-4-6";
const MAX_INVENTORY_CANDIDATES = 150;
const MAX_OUTPUT_TOKENS = 4096;

export type DeckAnalysis = {
  archetype: string;
  subArchetype: string | null;
  summary: string;
  winConditions: string[];
  gameplan: {
    earlyGame: string;
    midGame: string;
    lateGame: string;
  };
  weaknesses: string[];
  improvements: Array<{
    oracleId: string;
    cardName: string;
    rationale: string;
    replacesCardName: string | null;
  }>;
};

export type DeckAnalysisRecord = {
  analysis: DeckAnalysis;
  model: string;
  signature: string;
  analyzedAt: string;
};

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_deck_analysis",
  description:
    "Submit a structured analysis of an EDH/Commander deck covering archetype, win conditions, gameplan, weaknesses, and concrete suggested improvements drawn from the player's owned cards.",
  input_schema: {
    type: "object",
    required: [
      "archetype",
      "summary",
      "winConditions",
      "gameplan",
      "weaknesses",
      "improvements",
    ],
    properties: {
      archetype: {
        type: "string",
        description:
          "One- to three-word archetype label (e.g., 'Aristocrats', 'Voltron', 'Lifegain Combo').",
      },
      subArchetype: {
        type: ["string", "null"],
        description:
          "Optional finer-grained label (e.g., 'Reanimator Aristocrats') or null.",
      },
      summary: {
        type: "string",
        description:
          "One or two sentences describing what the deck is trying to do.",
      },
      winConditions: {
        type: "array",
        description:
          "Ranked list (most to least likely) of how the deck actually wins games. Be specific — name cards or interactions.",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
      },
      gameplan: {
        type: "object",
        required: ["earlyGame", "midGame", "lateGame"],
        properties: {
          earlyGame: {
            type: "string",
            description: "Turns 1–3 — ramp, setup, mulligan priorities.",
          },
          midGame: {
            type: "string",
            description: "Turns 4–6 — assembling the engine, threats, defense.",
          },
          lateGame: {
            type: "string",
            description: "Turn 7+ — closing lines, protection, key interactions.",
          },
        },
      },
      weaknesses: {
        type: "array",
        description:
          "Specific structural weaknesses or matchups where this deck struggles. Concrete, not platitudes.",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
      },
      improvements: {
        type: "array",
        description:
          "Suggested swaps drawn EXCLUSIVELY from the supplied inventory candidate list. Each must reference a candidate's oracleId. Order by priority. Up to 8 suggestions.",
        items: {
          type: "object",
          required: ["oracleId", "cardName", "rationale"],
          properties: {
            oracleId: {
              type: "string",
              description:
                "oracleId of the candidate from the inventory candidate list. MUST match exactly.",
            },
            cardName: { type: "string" },
            rationale: {
              type: "string",
              description: "One sentence on why this card improves the deck.",
            },
            replacesCardName: {
              type: ["string", "null"],
              description:
                "Optional: name of a card already in the deck that this could replace, or null if it's an add.",
            },
          },
        },
        maxItems: 8,
      },
    },
  },
};

export type InventoryCandidate = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  edhrecRank: number | null;
  ownedCount: number;
};

export function deckSignature(printingIds: string[]): string {
  const sorted = [...printingIds].sort();
  return createHash("sha256").update(sorted.join("|")).digest("hex").slice(0, 16);
}

export function deckSignatureFromDetail(detail: DeckDetail): string {
  const ids: string[] = [];
  if (detail.commander) ids.push(detail.commander.printing.id);
  if (detail.partner) ids.push(detail.partner.printing.id);
  for (const c of detail.cards) ids.push(c.deckCardRow.printingId);
  return deckSignature(ids);
}

/**
 * Pull up to 150 inventory candidates the user owns, that match the deck's
 * color identity, are Commander-legal, and aren't already in the deck.
 * Sorted by EDHREC rank (lower = more popular = stronger candidate).
 */
export async function fetchInventoryCandidates(
  deckId: string,
  colorIdentity: string[],
): Promise<InventoryCandidate[]> {
  const existing = await db
    .select({ oracleId: cards.oracleId })
    .from(deckCards)
    .innerJoin(printings, eq(printings.id, deckCards.printingId))
    .innerJoin(cards, eq(cards.oracleId, printings.oracleId))
    .where(eq(deckCards.deckId, deckId));
  const excludeOracleIds = new Set<string>(existing.map((r) => r.oracleId));

  // Commander has no commander.commanderPrintingId reference in deckCards,
  // so include it explicitly so the suggestion engine never recommends it.
  const deckRow = await db
    .select({
      commanderPrintingId: decks.commanderPrintingId,
      partnerPrintingId: decks.partnerPrintingId,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  for (const pid of [
    deckRow[0]?.commanderPrintingId,
    deckRow[0]?.partnerPrintingId,
  ]) {
    if (!pid) continue;
    const row = await db
      .select({ oracleId: printings.oracleId })
      .from(printings)
      .where(eq(printings.id, pid))
      .limit(1);
    if (row[0]) excludeOracleIds.add(row[0].oracleId);
  }

  // Color-identity filter: candidate's color identity must be a subset of the
  // deck's identity. Postgres array operator <@ does the work.
  const identity = colorIdentity.length > 0 ? colorIdentity : ["W", "U", "B", "R", "G"];
  const rows = await db.execute(sql`
    SELECT
      c.oracle_id,
      c.name,
      c.mana_cost,
      c.type_line,
      c.oracle_text,
      c.edhrec_rank,
      o.owned_count
    FROM cards c
    INNER JOIN oracle_ownership o ON o.oracle_id = c.oracle_id
    WHERE o.owned_count > 0
      AND c.is_commander_legal = TRUE
      AND COALESCE(c.color_identity, ARRAY[]::text[]) <@ ${sqlArray(identity, "text")}
    ORDER BY c.edhrec_rank ASC NULLS LAST, c.name ASC
    LIMIT ${MAX_INVENTORY_CANDIDATES + excludeOracleIds.size + 50};
  `);

  const candidates: InventoryCandidate[] = [];
  for (const r of rows as unknown as Array<{
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string | null;
    oracle_text: string | null;
    edhrec_rank: number | null;
    owned_count: number;
  }>) {
    if (excludeOracleIds.has(r.oracle_id)) continue;
    candidates.push({
      oracleId: r.oracle_id,
      name: r.name,
      manaCost: r.mana_cost,
      typeLine: r.type_line,
      oracleText: r.oracle_text,
      edhrecRank: r.edhrec_rank,
      ownedCount: r.owned_count,
    });
    if (candidates.length >= MAX_INVENTORY_CANDIDATES) break;
  }
  return candidates;
}

function formatDeckList(detail: DeckDetail): string {
  const lines: string[] = [];
  if (detail.commander) {
    lines.push(
      `COMMANDER: ${detail.commander.name} ${detail.commander.manaCost ?? ""}`,
    );
    lines.push(`Type: ${detail.commander.typeLine ?? ""}`);
    if (detail.commander.oracleText) {
      lines.push(`Text: ${detail.commander.oracleText.replace(/\n/g, " | ")}`);
    }
    lines.push("");
  }
  if (detail.partner) {
    lines.push(
      `PARTNER: ${detail.partner.name} ${detail.partner.manaCost ?? ""}`,
    );
    lines.push(`Type: ${detail.partner.typeLine ?? ""}`);
    if (detail.partner.oracleText) {
      lines.push(`Text: ${detail.partner.oracleText.replace(/\n/g, " | ")}`);
    }
    lines.push("");
  }

  const byCategory = new Map<string, typeof detail.cards>();
  for (const c of detail.cards) {
    const k = c.deckCardRow.category;
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(c);
  }
  for (const [category, list] of byCategory) {
    lines.push(`## ${category.toUpperCase()} (${list.length})`);
    for (const c of list) {
      const mana = c.card.manaCost ?? "";
      const type = c.card.typeLine ?? "";
      lines.push(`- ${c.card.name} ${mana} — ${type}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatCandidates(list: InventoryCandidate[]): string {
  const lines: string[] = [
    "Each line is a candidate the player ALREADY OWNS. Suggest improvements ONLY from this list, and reference candidates by oracleId.",
    "",
  ];
  for (const c of list) {
    const mana = c.manaCost ?? "";
    const type = c.typeLine ?? "";
    const rank = c.edhrecRank != null ? ` [EDHREC #${c.edhrecRank}]` : "";
    lines.push(`[${c.oracleId}] ${c.name} ${mana} — ${type}${rank} · owned ×${c.ownedCount}`);
  }
  return lines.join("\n");
}

function buildPrompt(
  detail: DeckDetail,
  candidates: InventoryCandidate[],
): string {
  const deckList = formatDeckList(detail);
  const candidateList = formatCandidates(candidates);
  const identity = detail.colorIdentity.join("") || "Colorless";
  return [
    `You are a Commander format strategist with deep knowledge of EDH archetypes, the metagame, card synergies, and deckbuilding theory. Analyze the deck below.`,
    ``,
    `DECK NAME: ${detail.deck.name}`,
    `COLOR IDENTITY: ${identity}`,
    `TOTAL CARDS: ${detail.totalCards}`,
    ``,
    deckList,
    ``,
    `============================================================`,
    `INVENTORY CANDIDATES (owned cards, color-identity compatible, Commander-legal, not in deck):`,
    `============================================================`,
    candidateList,
    ``,
    `Call the submit_deck_analysis tool with your analysis. Be concrete and specific — name cards, name interactions, name matchups. For improvements: every entry MUST cite an oracleId from the candidate list above. Do NOT invent cards or oracleIds.`,
  ].join("\n");
}

export async function analyzeDeck(detail: DeckDetail): Promise<DeckAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable the strategy advisor.",
    );
  }
  const client = new Anthropic({ apiKey });
  const candidates = await fetchInventoryCandidates(
    detail.deck.id,
    detail.colorIdentity,
  );
  const prompt = buildPrompt(detail, candidates);
  const candidateOracleIds = new Set(candidates.map((c) => c.oracleId));

  const response = await client.messages.create({
    model: STRATEGY_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_deck_analysis" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Model did not call submit_deck_analysis tool");
  }
  const raw = toolUse.input as DeckAnalysis;

  // Drop any improvement the model invented that doesn't actually exist in the
  // candidate set. Hallucination guard.
  const improvements = (raw.improvements ?? []).filter((imp) =>
    candidateOracleIds.has(imp.oracleId),
  );

  return {
    archetype: raw.archetype,
    subArchetype: raw.subArchetype ?? null,
    summary: raw.summary,
    winConditions: raw.winConditions ?? [],
    gameplan: raw.gameplan,
    weaknesses: raw.weaknesses ?? [],
    improvements,
  };
}

