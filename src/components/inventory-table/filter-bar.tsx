"use client";

import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ActiveChip,
  COLORS,
  COLOR_TOKEN,
  ToggleLabel,
  TYPE_OPTIONS,
} from "./parts";

// All filter inputs (name search, set, type, location, color pills,
// foil/banned/disposed toggles) plus the row of active-filter chips.
// Stateless: every value + setter is passed in so the parent owns the
// canonical filter state and can rebuild its inventory query params
// from it.

export type FilterBarProps = {
  // Name search — `nameFilter` is the immediate input, `debouncedName`
  // is what actually drives the query (debounced upstream).
  nameFilter: string;
  debouncedName: string;
  onNameChange: (v: string) => void;
  onNameClear: () => void;

  setFilter: string;
  onSetChange: (v: string) => void;

  typeFilter: string;
  onTypeChange: (v: string) => void;

  locationFilter: string;
  onLocationChange: (v: string) => void;
  locations: string[];

  colorFilter: Set<string>;
  onToggleColor: (c: string) => void;

  foilsOnly: boolean;
  onFoilsOnlyChange: (v: boolean) => void;

  bannedOnly: boolean;
  onBannedOnlyChange: (v: boolean) => void;

  includeDisposed: boolean;
  onIncludeDisposedChange: (v: boolean) => void;

  hasAnyFilter: boolean;
  onClearAll: () => void;
};

export function FilterBar({
  nameFilter,
  debouncedName,
  onNameChange,
  onNameClear,
  setFilter,
  onSetChange,
  typeFilter,
  onTypeChange,
  locationFilter,
  onLocationChange,
  locations,
  colorFilter,
  onToggleColor,
  foilsOnly,
  onFoilsOnlyChange,
  bannedOnly,
  onBannedOnlyChange,
  includeDisposed,
  onIncludeDisposedChange,
  hasAnyFilter,
  onClearAll,
}: FilterBarProps) {
  return (
    <section className="rounded-md border border-border-subtle bg-surface-inset/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-text-muted" />
          <input
            value={nameFilter}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Search by name…"
            className="h-7 w-full rounded-sm border border-border-subtle bg-surface-base pl-7 pr-2 text-[12px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
          />
        </div>
        <input
          value={setFilter}
          onChange={(e) => onSetChange(e.target.value)}
          placeholder="SET"
          className="h-7 w-20 rounded-sm border border-border-subtle bg-surface-base px-2 font-mono text-[11px] uppercase tracking-wide text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
        />
        <Select
          value={typeFilter || "__all"}
          onValueChange={(v) => onTypeChange(!v || v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-7! w-32 rounded-sm! border-border-subtle bg-surface-base text-[11px]!">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={locationFilter || "__all"}
          onValueChange={(v) => onLocationChange(!v || v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-7! w-40 rounded-sm! border-border-subtle bg-surface-base text-[11px]!">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-wide">
          <ToggleLabel checked={foilsOnly} onChange={onFoilsOnlyChange}>
            Foils only
          </ToggleLabel>
          <ToggleLabel checked={bannedOnly} onChange={onBannedOnlyChange}>
            Banned only
          </ToggleLabel>
          <ToggleLabel
            checked={false}
            disabled
            onChange={() => {}}
            title="Wires up when decks have inventory bindings"
          >
            Available
          </ToggleLabel>
          <ToggleLabel
            checked={includeDisposed}
            onChange={onIncludeDisposedChange}
          >
            + Disposed
          </ToggleLabel>
        </div>
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Colors
        </span>
        {COLORS.map((c) => {
          const isActive = colorFilter.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggleColor(c)}
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full border font-mono text-[9px] font-semibold transition-colors",
                isActive
                  ? "text-background"
                  : "border-border-subtle bg-surface-raised text-text-muted hover:border-border-strong",
              )}
              style={
                isActive
                  ? {
                      background: COLOR_TOKEN[c],
                      borderColor: COLOR_TOKEN[c],
                    }
                  : undefined
              }
              aria-pressed={isActive}
              aria-label={`Toggle ${c} color`}
            >
              {c}
            </button>
          );
        })}
        {hasAnyFilter && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:text-text-primary"
          >
            <X className="size-3" /> Clear filters
          </button>
        )}
      </div>
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border-subtle px-3 py-1.5">
          {debouncedName && (
            <ActiveChip
              label={`name "${debouncedName}"`}
              onClear={onNameClear}
            />
          )}
          {setFilter && (
            <ActiveChip
              label={`set ${setFilter.toUpperCase()}`}
              onClear={() => onSetChange("")}
            />
          )}
          {typeFilter && (
            <ActiveChip
              label={`type ${typeFilter}`}
              onClear={() => onTypeChange("")}
            />
          )}
          {locationFilter && (
            <ActiveChip
              label={`@ ${locationFilter}`}
              onClear={() => onLocationChange("")}
            />
          )}
          {[...colorFilter].map((c) => (
            <ActiveChip
              key={c}
              label={c}
              tint={COLOR_TOKEN[c]}
              onClear={() => onToggleColor(c)}
            />
          ))}
          {foilsOnly && (
            <ActiveChip
              label="foil only"
              onClear={() => onFoilsOnlyChange(false)}
            />
          )}
          {bannedOnly && (
            <ActiveChip
              label="banned only"
              onClear={() => onBannedOnlyChange(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}
