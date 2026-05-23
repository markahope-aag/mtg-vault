import { cn } from "@/lib/utils";

// Formats to surface, in display order. We intentionally drop Brawl/Penny
// Dreadful/Historic Brawl/Oathbreaker — they're too niche for a Commander-
// focused tool. Add more here if the user starts running them.
const FORMATS: Array<{ key: string; label: string }> = [
  { key: "commander", label: "Commander" },
  { key: "standard", label: "Standard" },
  { key: "pioneer", label: "Pioneer" },
  { key: "modern", label: "Modern" },
  { key: "legacy", label: "Legacy" },
  { key: "vintage", label: "Vintage" },
  { key: "pauper", label: "Pauper" },
  { key: "duel", label: "Duel" },
];

const TONE: Record<string, string> = {
  legal: "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/15 text-[var(--value-positive)]",
  restricted: "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300",
  banned: "border-[var(--value-negative)]/40 bg-[var(--value-negative)]/15 text-[var(--value-negative)]",
  not_legal: "border-border-subtle bg-surface-inset text-text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  legal: "Legal",
  restricted: "Restricted",
  banned: "Banned",
  not_legal: "Not legal",
};

export function LegalityBadges({
  legalities,
}: {
  legalities: Record<string, string> | null | undefined;
}) {
  if (!legalities) return null;

  // Hide formats the card has no entry for (extremely rare but possible
  // for un-set / promo-only cards). Default to "not_legal" otherwise so
  // every listed format gets a chip.
  const rows = FORMATS.map((f) => {
    const status = legalities[f.key] ?? "not_legal";
    return { ...f, status };
  });

  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {rows.map((r) => (
        <li
          key={r.key}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]",
            TONE[r.status] ?? TONE.not_legal,
          )}
        >
          <span className="font-medium">{r.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
