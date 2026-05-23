import Link from "next/link";
import { ManaCost } from "@/components/mana-cost";
import { ImgWithFallback } from "@/components/img-with-fallback";

export type SynergyEntry = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  imageUri: string | null;
  coDecks: number;
  edhrecRank: number | null;
  ownedCount: number;
};

// Grid layout for the synergy panel. Each tile links to the card's detail
// page and shows whether the user already owns a copy — the most actionable
// information when scanning for "what should I add next?"
export function SynergyGrid({ entries }: { entries: SynergyEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No synergies yet. Add this card to a deck and we&rsquo;ll start
        building the co-occurrence graph from your decklists.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map((e) => (
        <li key={e.oracleId}>
          <Link
            href={`/cards/${e.oracleId}`}
            className="group flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised p-2 transition-colors hover:bg-surface-inset"
          >
            <ImgWithFallback
              src={e.imageUri}
              alt={e.name}
              className="size-12 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
              fallbackClassName="flex size-12 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle"
              fallbackIconClassName="size-4"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-text-primary group-hover:text-[var(--brand)]">
                {e.name}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <ManaCost cost={e.manaCost} size="xs" />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide text-text-muted">
                <span>
                  ×{e.coDecks} {e.coDecks === 1 ? "deck" : "decks"}
                </span>
                {e.ownedCount > 0 ? (
                  <span className="text-[var(--value-positive)]">
                    Own {e.ownedCount}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
