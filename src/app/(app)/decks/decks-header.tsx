"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewDeckDialog } from "@/components/decks/new-deck-dialog";

export function DecksHeader({
  count,
  totalValueUsd,
}: {
  count: number;
  totalValueUsd: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
      <div className="space-y-2">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Decks
        </p>
        <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
          Your decks
        </h1>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-[var(--text-secondary)]">
          <span>
            <span className="num font-medium text-[var(--text-primary)]">
              {count}
            </span>{" "}
            deck{count === 1 ? "" : "s"}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>
            <span className="num font-medium text-[var(--text-primary)]">
              $
              {totalValueUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>{" "}
            combined value
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/decks/new/generate"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Sparkles className="size-3.5" /> Generate
        </Link>
        <Button size="sm" className="h-7 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" /> New deck
        </Button>
      </div>
      <NewDeckDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
