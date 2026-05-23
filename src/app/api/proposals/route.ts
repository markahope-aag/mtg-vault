import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { generateDeck } from "@/lib/rogue/generate";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
// Five LLM round-trips worst case (pick + generate + 3 repairs + analyze).
// 300s is generous; on Vercel Pro this is the max.
export const maxDuration = 300;

const bodySchema = z.object({
  kind: z.enum(["standard", "rogue"]).default("standard"),
  commanderOracleId: z.string().uuid().optional(),
  archetypeBrief: z.string().trim().max(2000).optional(),
  targetBracket: z.number().int().min(1).max(5).nullable().optional(),
  inventoryScope: z
    .enum(["unassigned", "all_owned", "ignore"])
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
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
