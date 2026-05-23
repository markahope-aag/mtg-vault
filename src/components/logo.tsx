import { cn } from "@/lib/utils";

/**
 * The MTG Vault mark — a financial-terminal "vault dial" with a stylized V.
 * Inherits color via `currentColor` so it adopts whatever text color the
 * surrounding link uses (e.g. brand amber on hover in the nav).
 */
export function Logo({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="MTG Vault"
      className={cn("shrink-0", className)}
    >
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="16" y1="2" x2="16" y2="5" />
        <line x1="30" y1="16" x2="27" y2="16" />
        <line x1="16" y1="30" x2="16" y2="27" />
        <line x1="2" y1="16" x2="5" y2="16" />
      </g>
      <path
        d="M 10.5 10.5 L 16 21 L 21.5 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
