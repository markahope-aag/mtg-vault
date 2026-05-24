"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

// Floating, fixed-position bar shown when one or more inventory rows
// are checked. Visible until the user clears the selection or acts.

export function BulkActionBar({
  selectedCount,
  onCreateDeck,
  onDispose,
  onClear,
}: {
  selectedCount: number;
  onCreateDeck: () => void;
  onDispose: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border-strong bg-surface-overlay px-4 py-2 shadow-lg shadow-black/30">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          Selected
        </span>
        <span className="num font-semibold text-text-primary">
          {selectedCount}
        </span>
        <span className="h-4 w-px bg-border-subtle" />
        <Button
          size="sm"
          className="h-7 gap-1.5 font-mono text-[11px] uppercase tracking-wide"
          onClick={onCreateDeck}
        >
          <Layers className="size-3.5" /> Create deck
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 font-mono text-[11px] uppercase tracking-wide"
          onClick={onDispose}
        >
          Dispose
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 font-mono text-[11px] uppercase tracking-wide text-text-muted hover:text-text-primary"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
