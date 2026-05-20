import { cn } from "@/lib/utils";

// Renders an MTG mana cost string (e.g. "{2}{W}{U}") as real Mana-font icons.
// Replaces the Phase-3 colored-circle placeholder.
//
// Mana font docs: https://github.com/andrewgioia/mana
//   <i class="ms ms-w ms-cost"></i>           — white mana with circle
//   <i class="ms ms-2 ms-cost"></i>           — 2 generic
//   <i class="ms ms-wu ms-cost ms-split"></i> — W/U hybrid
//   <i class="ms ms-wp ms-cost"></i>          — Phyrexian white
//   <i class="ms ms-tap"></i>                 — tap symbol

const SIZE_CLASS: Record<string, string> = {
  xs: "text-[10px]",
  sm: "text-[12px]",
  md: "text-[16px]",
  lg: "text-[20px]",
};

function symbolToClass(raw: string): { cls: string; isCostShape: boolean } {
  const s = raw.toLowerCase().replace(/\s+/g, "");
  // Generic numeric or X/Y/Z costs
  if (/^[0-9]+$/.test(s)) return { cls: `ms-${s}`, isCostShape: true };
  if (s === "x" || s === "y" || s === "z")
    return { cls: `ms-${s}`, isCostShape: true };
  if (s === "tap" || s === "t") return { cls: "ms-tap", isCostShape: false };
  if (s === "untap" || s === "q")
    return { cls: "ms-untap", isCostShape: false };
  if (s === "infinity" || s === "∞")
    return { cls: "ms-infinity", isCostShape: true };
  if (s === "s" || s === "snow") return { cls: "ms-s", isCostShape: true };
  if (s === "c" || s === "colorless")
    return { cls: "ms-c", isCostShape: true };
  if (s === "e" || s === "energy")
    return { cls: "ms-e", isCostShape: false };
  // Phyrexian: "wp" / "w/p"
  const phyrexian = s.replace(/[\/{}]/g, "");
  if (/^[wubrgc]p$/.test(phyrexian))
    return { cls: `ms-${phyrexian}`, isCostShape: true };
  // Hybrid: "w/u" → "wu"
  const hybrid = s.replace(/[\/{}]/g, "");
  if (/^[wubrgc2][wubrgc]$/.test(hybrid))
    return { cls: `ms-${hybrid}`, isCostShape: true };
  // Plain colour: w / u / b / r / g
  if (/^[wubrg]$/.test(s)) return { cls: `ms-${s}`, isCostShape: true };
  return { cls: "ms-c", isCostShape: true };
}

export function ManaCost({
  cost,
  size = "sm",
  className,
}: {
  cost: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  if (!cost) return null;
  const symbols = Array.from(cost.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]);
  if (symbols.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[2px] align-middle",
        SIZE_CLASS[size],
        className,
      )}
      aria-label={`mana cost ${cost}`}
    >
      {symbols.map((sym, i) => {
        const { cls, isCostShape } = symbolToClass(sym);
        return (
          <i
            key={i}
            className={cn("ms", cls, isCostShape && "ms-cost")}
            aria-hidden="true"
            title={`{${sym}}`}
          />
        );
      })}
    </span>
  );
}

// Color identity rendered as plain mana pips (no cost-circle outline).
export function ColorIdentityPips({
  identity,
  size = "sm",
  className,
}: {
  identity: string[] | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  if (!identity || identity.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-[10px] uppercase tracking-wide text-text-muted",
          className,
        )}
      >
        colorless
      </span>
    );
  }
  return (
    <ManaCost
      cost={identity.map((c) => `{${c}}`).join("")}
      size={size}
      className={className}
    />
  );
}
