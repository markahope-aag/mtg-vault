import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { generateDeck } from "@/lib/rogue/generate";
import { rateLimit } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-errors";
import { INVENTORY_SCOPES } from "@/lib/rogue/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const iterateSchema = z.object({
  instruction: z.string().trim().min(3).max(500),
  // Iteration MAY override these from the parent — used by the chip
  // shortcuts ("→ Bracket 2" changes target, "stay in my collection"
  // changes scope). Everything else is inherited.
  targetBracket: z.number().int().min(1).max(5).nullable().optional(),
  inventoryScope: z.enum(INVENTORY_SCOPES).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: parentId } = await params;

  // Same rate ceiling as fresh generation — iterating is the same cost
  // shape (one full pipeline run, including LLM critique on rogue).
  const limit = rateLimit("proposals", 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many generations this minute. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = iterateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { instruction, targetBracket, inventoryScope } = parsed.data;

  // Load the parent. Must be ready (a 'generating' or 'failed' parent
  // has no cardList to seed from).
  const [parent] = await db
    .select()
    .from(deckProposals)
    .where(eq(deckProposals.id, parentId))
    .limit(1);
  if (!parent) {
    return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }
  if (parent.status !== "ready" && parent.status !== "saved") {
    return NextResponse.json(
      { error: "Parent proposal isn't ready to iterate from." },
      { status: 409 },
    );
  }
  const parentCardList = Array.isArray(parent.cardList)
    ? (parent.cardList as Array<{ name: string; role?: string; rationale?: string }>)
    : [];
  if (parentCardList.length === 0) {
    return NextResponse.json(
      { error: "Parent has no cardList to seed from." },
      { status: 409 },
    );
  }

  // Create the child row up front so the client can navigate to it
  // and start polling — same pattern as POST /api/proposals.
  const [row] = await db
    .insert(deckProposals)
    .values({
      kind: parent.kind,
      commanderOracleId: parent.commanderOracleId,
      targetBracket: targetBracket !== undefined ? targetBracket : parent.targetBracket,
      archetypeBrief: parent.archetypeBrief,
      status: "generating",
      parentProposalId: parentId,
      iterateInstruction: instruction,
    })
    .returning({ id: deckProposals.id });

  try {
    const startedAt = new Date().toISOString();
    const result = await generateDeck({
      kind: parent.kind as "standard" | "rogue",
      commanderOracleId: parent.commanderOracleId ?? undefined,
      archetypeBrief: parent.archetypeBrief ?? undefined,
      targetBracket:
        targetBracket !== undefined ? targetBracket : parent.targetBracket,
      inventoryScope,
      iterateFrom: {
        parentCardList,
        parentRogueRationale:
          (parent.rogueRationale as
            | {
                consensusBuild?: string;
                chosenThesis?: { name?: string; description?: string };
                powerThesis?: {
                  underratedClaim?: string;
                  specificMechanic?: string;
                  whyItCouldWork?: string;
                };
              }
            | null) ?? null,
        instruction,
      },
      onProgress: async (phase) => {
        await db
          .update(deckProposals)
          .set({
            generationLog: {
              currentPhase: phase,
              startedAt,
              updatedAt: new Date().toISOString(),
            },
          })
          .where(eq(deckProposals.id, row.id));
      },
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
    console.error("[api/proposals/iterate POST] generation failed", err);
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
      "api/proposals/iterate POST",
      err,
      "Iteration failed. The child proposal was saved with the failure log.",
    );
  }
}
