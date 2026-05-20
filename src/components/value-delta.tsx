import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Financial convention: green up, red down. Numeric font, tabular figures.

export function ValueDelta({
  value,
  prefix = "$",
  precision = 2,
  showZeroAsNeutral = true,
  className,
}: {
  value: number | null | undefined;
  prefix?: string;
  precision?: number;
  showZeroAsNeutral?: boolean;
  className?: string;
}) {
  if (value == null || (showZeroAsNeutral && Math.abs(value) < 1e-9)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[var(--color-value-neutral)] tabular-nums",
          className,
        )}
      >
        <Minus className="size-3" />
        {prefix}0.00
      </span>
    );
  }
  const positive = value > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const colour = positive
    ? "text-[var(--color-value-positive)]"
    : "text-[var(--color-value-negative)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono tabular-nums",
        colour,
        className,
      )}
    >
      <Icon className="size-3" />
      {positive ? "+" : "−"}
      {prefix}
      {Math.abs(value).toFixed(precision)}
    </span>
  );
}
