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
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <DecksHeader count={decks.length} totalValueUsd={totalValue} />

      {decks.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 p-12 text-center">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Empty
          </p>
          <h2 className="mt-2 font-[var(--font-display)] text-[18px] font-semibold">
            No decks yet
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Create one to start tracking what you&rsquo;re building.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <DeckCardTile key={d.id} deck={d} />
          ))}
        </div>
      )}
    </div>
  );
}
