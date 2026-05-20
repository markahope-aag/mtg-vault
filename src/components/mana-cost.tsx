import { cn } from "@/lib/utils";

// Maps Scryfall mana-symbol strings (the contents between {…}) to the visual
// treatment for the colored circle. Hybrid and Phyrexian symbols fall back to
// a generic style — good enough for v0, can swap in proper icons later.
const SYMBOL_STYLES: Record<string, string> = {
  W: "bg-amber-50 text-amber-900 border border-amber-200",
  U: "bg-sky-100 text-sky-900 border border-sky-200",
  B: "bg-zinc-800 text-zinc-100 border border-zinc-700",
  R: "bg-red-100 text-red-900 border border-red-200",
  G: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  C: "bg-stone-200 text-stone-700 border border-stone-300",
  X: "bg-stone-200 text-stone-700 border border-stone-300",
  T: "bg-stone-200 text-stone-700 border border-stone-300",
  Q: "bg-stone-200 text-stone-700 border border-stone-300",
  S: "bg-sky-50 text-sky-900 border border-sky-200",
};

const DEFAULT_STYLE = "bg-stone-200 text-stone-700 border border-stone-300";

function symbolClass(symbol: string): string {
  if (/^[0-9]+$/.test(symbol)) return DEFAULT_STYLE;
  return SYMBOL_STYLES[symbol.toUpperCase()] ?? DEFAULT_STYLE;
}

function symbolLabel(symbol: string): string {
  // Hybrid / Phyrexian symbols like "W/U", "G/P" — show the first non-numeric
  // letter, or the full thing for short pip costs.
  const cleaned = symbol.replace(/\//g, "");
  if (cleaned.length <= 2) return cleaned;
  return cleaned[0] ?? "";
}

export function ManaCost({
  cost,
  size = "sm",
  className,
}: {
  cost: string | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  if (!cost) return null;
  const symbols = Array.from(cost.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]);
  if (symbols.length === 0) return null;

  const sizeClass =
    size === "xs"
      ? "h-3.5 w-3.5 text-[9px]"
      : size === "md"
        ? "h-6 w-6 text-xs"
        : "h-4 w-4 text-[10px]";

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {symbols.map((sym, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
            sizeClass,
            symbolClass(sym),
          )}
          title={`{${sym}}`}
        >
          {symbolLabel(sym)}
        </span>
      ))}
    </span>
  );
}
