import { cn } from "@/lib/utils";

// Keyrune renders set symbols by set code: <i class="ss ss-neo"></i>.
// Reference: https://github.com/andrewgioia/keyrune
//
// We deliberately do NOT use Keyrune's rarity classes (ss-common/uncommon/
// rare/mythic). Those force fixed fills — common is near-black, the others
// are metallic gradients — and several render too dim to see on the dark
// surface. Instead every symbol inherits `currentColor`, so it's always as
// legible as the text around it, in either theme. The `rarity` prop is kept
// only for the accessible label.

const SIZE_CLASS: Record<string, string> = {
  xs: "text-[12px]",
  sm: "text-[14px]",
  md: "text-[18px]",
  lg: "text-[24px]",
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
  return (
    <i
      className={cn(
        "ss",
        `ss-${code}`,
        SIZE_CLASS[size],
        "align-middle",
        className,
      )}
      aria-label={`${setCode.toUpperCase()} set symbol${rarity ? ` (${rarity})` : ""}`}
      title={setCode.toUpperCase()}
    />
  );
}
