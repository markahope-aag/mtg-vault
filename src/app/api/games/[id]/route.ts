import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { games, gamePlayers } from "@/db/schema";
import { getGame } from "@/lib/games/queries";
import { patchGameSchema } from "@/lib/games/schemas";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const game = await getGame(id);
    if (!game) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(game);
  } catch (err) {
    return serverError("api/games/[id] GET", err, "Failed to load game.");
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const ok = await db.transaction(async (tx) => {
      const update: Record<string, unknown> = {};
      if (input.playedAt !== undefined)
        update.playedAt = input.playedAt ? new Date(input.playedAt) : null;
      for (const k of [
        "myDeckId",
        "myDeckNameSnapshot",
        "podSize",
        "myFinish",
        "won",
        "podBracket",
        "durationMinutes",
        "winType",
        "notes",
      ] as const) {
        if (input[k] !== undefined) update[k] = input[k];
      }

      let matched = true;
      if (Object.keys(update).length > 0) {
        const result = await tx
          .update(games)
          .set(update)
          .where(eq(games.id, id))
          .returning({ id: games.id });
        matched = result.length > 0;
      } else {
        const exists = await tx
          .select({ id: games.id })
          .from(games)
          .where(eq(games.id, id))
          .limit(1);
        matched = exists.length > 0;
      }
      if (!matched) return false;

      // Players are replaced wholesale when provided. Diff semantics
      // for the row-set would invite drift; the table is small (≤8 rows
      // per game) and the form always re-submits the full pod anyway.
      if (input.players !== undefined) {
        await tx.delete(gamePlayers).where(eq(gamePlayers.gameId, id));
        if (input.players.length > 0) {
          await tx.insert(gamePlayers).values(
            input.players.map((p) => ({
              gameId: id,
              isMe: p.isMe ?? false,
              playerName: p.playerName ?? null,
              commanderOracleId: p.commanderOracleId ?? null,
              commanderNameSnapshot: p.commanderNameSnapshot ?? null,
              finish: p.finish ?? null,
              knockedOutBy: p.knockedOutBy ?? null,
            })),
          );
        }
      }
      return true;
    });

    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("api/games/[id] PATCH", err, "Failed to update game.");
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    // gamePlayers cascade-deletes via FK; only need to delete the game row.
    const result = await db
      .delete(games)
      .where(eq(games.id, id))
      .returning({ id: games.id });
    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("api/games/[id] DELETE", err, "Failed to delete game.");
  }
}
