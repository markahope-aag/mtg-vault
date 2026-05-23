import Link from "next/link";
import { Star } from "lucide-react";
import { ManaCost } from "@/components/mana-cost";
import { ImgWithFallback } from "@/components/img-with-fallback";

export type DeckCardTileData = {
  id: string;
  name: string;
  commanderName: string | null;
  commanderImageUri: string | null;
  partnerName: string | null;
  colorIdentity: string[] | null;
  totalCards: number;
  totalValueUsd: number;
  targetBracket: number | null;
  isPrimary: boolean;
};

const BRACKET_STYLES: Record<number, string> = {
  1: "bg-stone-200 text-stone-800",
  2: "bg-emerald-100 text-emerald-900",
  3: "bg-amber-100 text-amber-900",
  4: "bg-orange-200 text-orange-900",
  5: "bg-rose-200 text-rose-900",
};

const BRACKET_LABEL: Record<number, string> = {
  1: "B1 Exhibition",
  2: "B2 Core",
  3: "B3 Upgraded",
  4: "B4 Optimized",
  5: "B5 cEDH",
};

export function DeckCardTile({ deck }: { deck: DeckCardTileData }) {
  return (
    <Link
      href={`/decks/${deck.id}`}
      className="group relative aspect-[5/7] overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <ImgWithFallback
        src={deck.commanderImageUri}
        alt={deck.commanderName ?? deck.name}
        className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
        fallbackClassName="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
        fallbackIconClassName="size-10"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* Top-right badges */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        {deck.isPrimary && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
            <Star className="size-3 fill-amber-950" /> Primary
          </span>
        )}
        {deck.targetBracket && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BRACKET_STYLES[deck.targetBracket]}`}
          >
            {BRACKET_LABEL[deck.targetBracket]}
          </span>
        )}
      </div>

      <div className="absolute inset-x-3 bottom-3 space-y-2 text-white">
        <h3 className="text-lg font-semibold leading-tight drop-shadow-sm">
          {deck.name}
        </h3>
        <p className="text-xs text-white/80">
          {deck.commanderName ?? "No commander yet"}
          {deck.partnerName && <> · {deck.partnerName}</>}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          {deck.colorIdentity && deck.colorIdentity.length > 0 ? (
            <ManaCost
              cost={deck.colorIdentity.map((c) => `{${c}}`).join("")}
              size="sm"
            />
          ) : (
            <span className="text-[10px] text-white/60">colorless</span>
          )}
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-white/90">{deck.totalCards}/100</span>
            <span className="text-white/70">
              ${deck.totalValueUsd.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
