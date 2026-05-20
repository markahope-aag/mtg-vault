import { cn } from "@/lib/utils";

const TONE: Record<number, string> = {
  1: "bg-[var(--color-bracket-1)]/15 text-[var(--color-bracket-1)] border-[var(--color-bracket-1)]/30",
  2: "bg-[var(--color-bracket-2)]/15 text-[var(--color-bracket-2)] border-[var(--color-bracket-2)]/30",
  3: "bg-[var(--color-bracket-3)]/15 text-[var(--color-bracket-3)] border-[var(--color-bracket-3)]/30",
  4: "bg-[var(--color-bracket-4)]/15 text-[var(--color-bracket-4)] border-[var(--color-bracket-4)]/30",
  5: "bg-[var(--color-bracket-5)]/15 text-[var(--color-bracket-5)] border-[var(--color-bracket-5)]/30",
};

const NAME: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

export function BracketBadge({
  bracket,
  showName = false,
  prefix,
  className,
}: {
  bracket: number | null | undefined;
  showName?: boolean;
  prefix?: string;
  className?: string;
}) {
  if (bracket == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted",
          className,
        )}
      >
        {prefix ? `${prefix} ` : ""}—
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        TONE[bracket],
        className,
      )}
    >
      {prefix ? `${prefix} ` : ""}B{bracket}
      {showName ? ` ${NAME[bracket]}` : ""}
    </span>
  );
}
