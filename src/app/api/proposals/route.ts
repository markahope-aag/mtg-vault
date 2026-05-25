import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { generateDeck } from "@/lib/rogue/generate";
import { generateProposalSchema } from "@/lib/rogue/schemas";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
// Five LLM round-trips worst case (pick + generate + 3 repairs + analyze).
// 300s is generous; on Vercel Pro this is the max.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = generateProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Create the proposal row up front so the client can navigate to its
  // detail page and start polling even while generation runs.
  const [row] = await db
    .insert(deckProposals)
    .values({
      kind: input.kind,
      commanderOracleId: input.commanderOracleId ?? null,
      targetBracket: input.targetBracket ?? null,
      archetypeBrief: input.archetypeBrief ?? null,
      status: "generating",
    })
    .returning({ id: deckProposals.id });

  try {
    const result = await generateDeck({
      kind: input.kind,
      commanderOracleId: input.commanderOracleId,
      archetypeBrief: input.archetypeBrief,
      targetBracket: input.targetBracket ?? null,
      inventoryScope: input.inventoryScope,
    });

    await db
      .update(deckProposals)
      .set({
        status: "ready",
        commanderOracleId: result.commanderOracleId,
        cardList: result.cardList,
        analysis: result.analysis,
        rogueRationale: result.rogueRationale ?? null,
        critique: result.critique ?? null,
        generationLog: result.log,
        model: result.log.model.generate,
      })
      .where(eq(deckProposals.id, row.id));

    return NextResponse.json({ id: row.id, ok: result.ok }, { status: 201 });
  } catch (err) {
    // Persist a SAFE failure summary on the proposal row so the
    // Builder tab can surface "generation failed" + a timestamp. The
    // full error (including stack trace) is logged server-side via
    // serverError; we deliberately DO NOT store the stack on the
    // proposal row because GET /api/proposals/[id] returns the row
    // verbatim to any allowlisted user. Stack traces from a third-
    // party SDK (Anthropic) can leak internal paths, prompt snippets,
    // and partial responses — none of which belongs in the client
    // payload.
    console.error("[api/proposals POST] generation failed", err);
    await db
      .update(deckProposals)
      .set({
        status: "failed",
        generationLog: {
          error:
            err instanceof Error
              ? err.message.slice(0, 500)
              : "Generation failed.",
          at: new Date().toISOString(),
        },
      })
      .where(eq(deckProposals.id, row.id));
    return serverError(
      "api/proposals POST",
      err,
      "Deck generation failed. The proposal was saved with the failure log.",
    );
  }
}
