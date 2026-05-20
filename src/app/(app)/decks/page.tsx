import { listDecks } from "@/lib/decks/queries";
import { DecksHeader } from "./decks-header";
import { DeckCardTile } from "@/components/decks/deck-card-tile";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const decks = await listDecks({
    sort: "updatedAt",
    direction: "desc",
    filters: {},
  });

  const totalValue = decks.reduce((s, d) => s + d.totalValueUsd, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <DecksHeader count={decks.length} totalValueUsd={totalValue} />

      {decks.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No decks yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to start tracking what you&rsquo;re building.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <DeckCardTile key={d.id} deck={d} />
          ))}
        </div>
      )}
    </div>
  );
}
