import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { games, gamePlayers, decks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createGameSchema, listGamesQuerySchema } from "@/lib/games/schemas";
import { listGames } from "@/lib/games/queries";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = listGamesQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const rows = await listGames(parsed.data);
    return NextResponse.json({ games: rows });
  } catch (err) {
    return serverError("api/games GET", err, "Failed to list games.");
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      // Snapshot the deck name at log time so later renames/deletes
      // don't lose the historical record. If the user supplied a name
      // directly (deck not in app), trust that.
      let deckNameSnapshot = input.myDeckNameSnapshot?.trim() ?? null;
      if (input.myDeckId && !deckNameSnapshot) {
        const [d] = await tx
          .select({ name: decks.name })
          .from(decks)
          .where(eq(decks.id, input.myDeckId))
          .limit(1);
        deckNameSnapshot = d?.name ?? null;
      }

      // myFinish === 1 implies won. The form usually sets `won` directly
      // (yes/no toggle), but if only myFinish is provided we backfill so
      // queries can rely on `won` being authoritative.
      const won =
        input.won != null
          ? input.won
          : input.myFinish != null
            ? input.myFinish === 1
            : null;

      const [row] = await tx
        .insert(games)
        .values({
          playedAt: new Date(input.playedAt),
          myDeckId: input.myDeckId ?? null,
          myDeckNameSnapshot: deckNameSnapshot,
          podSize: input.podSize ?? null,
          myFinish: input.myFinish ?? null,
          won,
          podBracket: input.podBracket ?? null,
          durationMinutes: input.durationMinutes ?? null,
          winType: input.winType ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: games.id });

      const players = input.players ?? [];
      if (players.length > 0) {
        await tx.insert(gamePlayers).values(
          players.map((p) => ({
            gameId: row.id,
            isMe: p.isMe ?? false,
            playerName: p.playerName ?? null,
            commanderOracleId: p.commanderOracleId ?? null,
            commanderNameSnapshot: p.commanderNameSnapshot ?? null,
            finish: p.finish ?? null,
            knockedOutBy: p.knockedOutBy ?? null,
          })),
        );
      }

      return { id: row.id };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serverError("api/games POST", err, "Failed to create game.");
  }
}
