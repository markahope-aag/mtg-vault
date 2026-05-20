import { cn } from "@/lib/utils";

// Keyrune renders set symbols by set code with rarity coloring.
//   <i class="ss ss-neo ss-mythic"></i>
// Reference: https://github.com/andrewgioia/keyrune

const SIZE_CLASS: Record<string, string> = {
  xs: "text-[12px]",
  sm: "text-[14px]",
  md: "text-[18px]",
  lg: "text-[24px]",
};

const RARITY_MAP: Record<string, string> = {
  common: "ss-common",
  uncommon: "ss-uncommon",
  rare: "ss-rare",
  mythic: "ss-mythic",
  bonus: "ss-mythic",
  special: "ss-mythic",
};

export function SetSymbol({
  setCode,
  rarity,
  size = "sm",
  className,
}: {
  setCode: string | null | undefined;
  rarity?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  if (!setCode) return null;
  const code = setCode.toLowerCase();
  const rarityClass = rarity ? RARITY_MAP[rarity.toLowerCase()] : undefined;
  return (
    <i
      className={cn(
        "ss",
        `ss-${code}`,
        rarityClass,
        SIZE_CLASS[size],
        "align-middle",
        className,
      )}
      aria-label={`${setCode.toUpperCase()} set symbol${rarity ? ` (${rarity})` : ""}`}
      title={setCode.toUpperCase()}
    />
  );
}
