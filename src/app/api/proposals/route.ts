import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { generateDeck } from "@/lib/rogue/generate";
import { generateProposalSchema } from "@/lib/rogue/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
// Five LLM round-trips worst case (pick + generate + 3 repairs + analyze).
// 300s is generous; on Vercel Pro this is the max.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Most expensive LLM call in the app — up to 5 Sonnet round-trips
  // per generation, each taking 30-60s. A legitimate human paces
  // ~2/min at most; 20/min is the runaway-loop ceiling.
  const limit = rateLimit("proposals", 20);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Too many generations this minute. Try again shortly.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

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
    await db
      .update(deckProposals)
      .set({
        status: "failed",
        generationLog: {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
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
