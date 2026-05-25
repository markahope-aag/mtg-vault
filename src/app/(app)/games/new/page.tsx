import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { decks, games } from "@/db/schema";
import { BackLink } from "@/components/back-link";
import { GameForm } from "@/components/games/game-form";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  // Pull the deck list for the picker plus the most recently-played
  // deck so a back-to-back session defaults to the right deck.
  const [deckRows, recent] = await Promise.all([
    db
      .select({ id: decks.id, name: decks.name })
      .from(decks)
      .orderBy(decks.name),
    db
      .select({ deckId: games.myDeckId })
      .from(games)
      .where(sql`${games.myDeckId} IS NOT NULL`)
      .orderBy(desc(games.playedAt))
      .limit(1),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/games" label="Games" />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log a game</h1>
        <p className="mt-1 text-sm text-text-muted">
          What happened at the table. Pick your deck, the pod bracket
          everyone agreed to play at, and how you finished — that&rsquo;s
          enough. Opponents are optional but matter for matchup data.
        </p>
      </header>
      <GameForm
        decks={deckRows}
        defaultDeckId={recent[0]?.deckId ?? null}
      />
    </div>
  );
}
