// Shared constants for the bracket panel + its subviews. The bracket
// numbers (1-5) and severity buckets (blocking / limiting / note) come
// from the BracketResult shape in @/lib/bracket-engine; these are
// presentation lookups keyed off that vocabulary.

export const BRACKET_NAME: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

export const BRACKET_HERO_TONE: Record<number, string> = {
  1: "bg-[var(--color-bracket-1)]/12 text-[var(--color-bracket-1)] border-[var(--color-bracket-1)]/30",
  2: "bg-[var(--color-bracket-2)]/12 text-[var(--color-bracket-2)] border-[var(--color-bracket-2)]/30",
  3: "bg-[var(--color-bracket-3)]/12 text-[var(--color-bracket-3)] border-[var(--color-bracket-3)]/30",
  4: "bg-[var(--color-bracket-4)]/12 text-[var(--color-bracket-4)] border-[var(--color-bracket-4)]/30",
  5: "bg-[var(--color-bracket-5)]/12 text-[var(--color-bracket-5)] border-[var(--color-bracket-5)]/30",
};

export const SEVERITY_PRESENTATION: Record<
  "blocking" | "limiting" | "note",
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    dot: string;
  }
> = {
  blocking: {
    label: "Blocking",
    border: "border-[var(--color-value-negative)]/40",
    bg: "bg-[var(--color-value-negative)]/8",
    text: "text-[var(--color-value-negative)]",
    dot: "bg-[var(--color-value-negative)]",
  },
  limiting: {
    label: "Limiting",
    border: "border-[var(--color-bracket-3)]/40",
    bg: "bg-[var(--color-bracket-3)]/8",
    text: "text-[var(--color-bracket-3)]",
    dot: "bg-[var(--color-bracket-3)]",
  },
  note: {
    label: "Note",
    border: "border-border-subtle",
    bg: "bg-surface-inset/50",
    text: "text-text-muted",
    dot: "bg-text-muted",
  },
};

export type SnapshotRow = {
  id: string;
  snapshotAt: string;
  totalValueUsd: string | null;
  calculatedBracket: number | null;
  bracketReasons: unknown;
};
