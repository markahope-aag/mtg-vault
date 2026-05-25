import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { bracketDescription, computeManabase, extractTool } from "./generate";

// generate.ts is a multi-pass LLM pipeline; the LLM-touching passes
// aren't worth testing without real API keys (cost) or a heavy SDK
// mock (maintenance). These tests cover the two pure surfaces that
// CAN be locked down without spinning up Anthropic:
//
// 1. computeManabase — the deterministic land-distribution math the
//    generator runs after the LLM emits its color-pip target. Branches:
//    colorless, mono, multicolor proportional, rounding-drift parking.
//
// 2. extractTool — the tool-use parser that pulls the first matching
//    tool block out of an Anthropic.Message. Success path + two error
//    paths (max_tokens truncation and missing tool call) that the
//    pipeline relies on to fail loudly rather than silently produce
//    garbage.

describe("bracketDescription", () => {
  it("returns a description for each bracket tier", () => {
    expect(bracketDescription(1)).toContain("Exhibition");
    expect(bracketDescription(2)).toContain("Core");
    expect(bracketDescription(3)).toContain("Upgraded");
    expect(bracketDescription(4)).toContain("Optimized");
    expect(bracketDescription(5)).toContain("cEDH");
  });

  it("defaults to bracket 3 guidance when bracket is null", () => {
    expect(bracketDescription(null)).toContain("bracket 3");
  });
});

describe("computeManabase", () => {
  it("returns Wastes for a colorless commander", () => {
    const r = computeManabase({
      colorIdentity: [],
      colorPipTarget: { W: 0, U: 0, B: 0, R: 0, G: 0 },
      nonlandAvgCmc: 3,
    });
    expect(r.totalLands).toBe(37);
    expect(r.lands).toEqual([{ name: "Wastes", count: 37 }]);
  });

  it("returns all-basics-of-one-color for mono commanders", () => {
    const r = computeManabase({
      colorIdentity: ["R"],
      colorPipTarget: { W: 0, U: 0, B: 0, R: 12, G: 0 },
      nonlandAvgCmc: 3,
    });
    expect(r.lands).toEqual([{ name: "Mountain", count: 37 }]);
  });

  it("adjusts total land count down for a low curve", () => {
    const r = computeManabase({
      colorIdentity: ["U"],
      colorPipTarget: { W: 0, U: 1, B: 0, R: 0, G: 0 },
      nonlandAvgCmc: 2.0, // <2.5 → 36 lands
    });
    expect(r.totalLands).toBe(36);
  });

  it("adjusts total land count up for a high curve", () => {
    const r = computeManabase({
      colorIdentity: ["G"],
      colorPipTarget: { W: 0, U: 0, B: 0, R: 0, G: 1 },
      nonlandAvgCmc: 4.0, // >=3.5 → 38 lands
    });
    expect(r.totalLands).toBe(38);
  });

  it("splits a two-color manabase proportionally to pip targets", () => {
    // 3:1 pip ratio → ~75/25 split of 37 lands.
    const r = computeManabase({
      colorIdentity: ["U", "R"],
      colorPipTarget: { W: 0, U: 9, B: 0, R: 3, G: 0 },
      nonlandAvgCmc: 3,
    });
    expect(r.totalLands).toBe(37);
    const island = r.lands.find((l) => l.name === "Island");
    const mountain = r.lands.find((l) => l.name === "Mountain");
    expect(island).toBeDefined();
    expect(mountain).toBeDefined();
    // 9/12 of 37 = 27 (floor); 3/12 of 37 = 9 (floor); drift = 1
    // gets parked on the higher-pip color (Island).
    expect(island!.count + mountain!.count).toBe(37);
    expect(island!.count).toBeGreaterThan(mountain!.count);
  });

  it("falls back to an even split when all pip counts are zero", () => {
    const r = computeManabase({
      colorIdentity: ["W", "B"],
      colorPipTarget: { W: 0, U: 0, B: 0, R: 0, G: 0 },
      nonlandAvgCmc: 3,
    });
    const plains = r.lands.find((l) => l.name === "Plains")!;
    const swamp = r.lands.find((l) => l.name === "Swamp")!;
    expect(plains.count + swamp.count).toBe(37);
    // Even-split fallback: 18/19 or 19/18. Drift parks on the first
    // color in the sort tiebreak — either order is acceptable as long
    // as no land is missing.
    expect(Math.abs(plains.count - swamp.count)).toBeLessThanOrEqual(1);
  });

  it("ignores colors not in the BASIC_FOR_COLOR map (e.g. C)", () => {
    const r = computeManabase({
      colorIdentity: ["W", "U", "C"], // C is a Scryfall artifact, not a basic
      colorPipTarget: { W: 5, U: 5, B: 0, R: 0, G: 0 },
      nonlandAvgCmc: 3,
    });
    expect(r.lands.every((l) => l.name === "Plains" || l.name === "Island"))
      .toBe(true);
    const total = r.lands.reduce((s, l) => s + l.count, 0);
    expect(total).toBe(37);
  });

  it("five-color WUBRG splits + parks drift on the largest pip color", () => {
    const r = computeManabase({
      colorIdentity: ["W", "U", "B", "R", "G"],
      colorPipTarget: { W: 1, U: 1, B: 1, R: 1, G: 5 },
      nonlandAvgCmc: 3,
    });
    const total = r.lands.reduce((s, l) => s + l.count, 0);
    expect(total).toBe(37);
    // Green has the largest pip target — should end up with the most
    // lands AND absorb any rounding drift.
    const counts = Object.fromEntries(r.lands.map((l) => [l.name, l.count]));
    expect(counts["Forest"]).toBeGreaterThan(counts["Plains"] ?? 0);
  });
});

// ─── extractTool ────────────────────────────────────────────────

function fakeMessage(
  blocks: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; name: string; input: unknown }
  >,
  stop_reason: Anthropic.Message["stop_reason"] = "end_turn",
): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: blocks.map((b, i) =>
      b.type === "text"
        ? { type: "text", text: b.text, citations: null }
        : {
            type: "tool_use",
            id: `tool_${i}`,
            name: b.name,
            input: b.input,
          },
    ) as Anthropic.Message["content"],
    stop_reason,
    stop_details: null,
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: null,
      inference_geo: null,
      server_tool_use: null,
      service_tier: null,
    },
    container: null,
  };
}

describe("extractTool", () => {
  it("returns the input of the first matching tool_use block", () => {
    const msg = fakeMessage([
      { type: "text", text: "thinking…" },
      { type: "tool_use", name: "submit_deck", input: { cards: ["Sol Ring"] } },
    ]);
    const result = extractTool<{ cards: string[] }>(msg, "submit_deck");
    expect(result.cards).toEqual(["Sol Ring"]);
  });

  it("ignores tool_use blocks whose name doesn't match", () => {
    const msg = fakeMessage([
      { type: "tool_use", name: "some_other_tool", input: { foo: 1 } },
    ]);
    expect(() => extractTool(msg, "submit_deck")).toThrow(
      /did not call submit_deck/,
    );
  });

  it("throws with a specific 'truncated at the token cap' message when stop_reason is max_tokens", () => {
    const msg = fakeMessage([{ type: "text", text: "partial" }], "max_tokens");
    expect(() => extractTool(msg, "submit_deck")).toThrow(
      /truncated at the token cap during submit_deck/,
    );
  });

  it("throws with the generic 'did not call' message for other stop reasons", () => {
    const msg = fakeMessage([{ type: "text", text: "no tool used" }], "end_turn");
    expect(() => extractTool(msg, "submit_deck")).toThrow(
      /did not call submit_deck.*stop_reason: end_turn/,
    );
  });
});
