"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Decks</h1>
        <p className="text-sm text-muted-foreground">
          {count} deck{count === 1 ? "" : "s"} · ${totalValueUsd.toFixed(2)}{" "}
          combined value
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New deck
      </Button>
      <NewDeckDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
