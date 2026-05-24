"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { cn } from "@/lib/utils";
import type { SortField } from "./logic";

// Shared small parts + constants used by the filter bar and the
// grouped/physical views. Kept in one file so the public surface of the
// inventory-table folder stays compact; each piece is a tight, low-state
// presentational widget.

export const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

export const TYPE_OPTIONS = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
];

export const COLOR_TOKEN: Record<string, string> = {
  W: "var(--color-mtg-white)",
  U: "var(--color-mtg-blue)",
  B: "var(--color-mtg-black)",
  R: "var(--color-mtg-red)",
  G: "var(--color-mtg-green)",
  C: "var(--color-mtg-colorless)",
};

export function ViewToggle({
  grouped,
  onChange,
}: {
  grouped: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      role="group"
      className="inline-flex overflow-hidden rounded-md border border-border-subtle"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "h-7 px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
          grouped
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
            : "bg-surface-raised text-text-muted hover:text-text-primary",
        )}
        aria-pressed={grouped}
      >
        Grouped
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "h-7 border-l border-border-subtle px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
          !grouped
            ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
            : "bg-surface-raised text-text-muted hover:text-text-primary",
        )}
        aria-pressed={!grouped}
      >
        Physical
      </button>
    </div>
  );
}

export function ToggleLabel({
  checked,
  disabled,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5 text-text-secondary",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3 cursor-pointer accent-[var(--color-brand)]"
      />
      {children}
    </label>
  );
}

export function ActiveChip({
  label,
  onClear,
  tint,
}: {
  label: string;
  onClear: () => void;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="group/chip inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      {tint && (
        <span className="size-1.5 rounded-full" style={{ background: tint }} />
      )}
      {label}
      <X className="size-2.5 opacity-60 group-hover/chip:opacity-100" />
    </button>
  );
}

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="empty-terminal">
        {hasFilters ? "no matches" : "no inventory recorded"}
      </p>
      {hasFilters ? (
        <p className="text-sm text-text-secondary">
          No rows match the current filters.
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          Press{" "}
          <kbd className="rounded-sm border border-border-subtle bg-surface-inset px-1 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          to search and add your first card, or import a CSV.
        </p>
      )}
    </div>
  );
}

export function SortHeader({
  field,
  current,
  dir,
  onSort,
  className,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors",
          isActive
            ? "text-[var(--color-brand-strong)]"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        {children}
        <Icon
          className={cn("size-3", isActive ? "opacity-100" : "opacity-40")}
        />
      </button>
    </th>
  );
}

export function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <ImgWithFallback
      src={src}
      alt={alt}
      className="size-9 rounded-sm object-cover ring-1 ring-border-subtle"
      fallbackClassName="flex size-9 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle"
      fallbackIconClassName="size-3.5"
      loading="lazy"
    />
  );
}
