"use client";

import { useState } from "react";
import { ImageOff, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManaCost } from "@/components/mana-cost";
import type { DeckDetail } from "@/lib/decks/types";
import { EditDeckDialog } from "@/components/decks/edit-deck-dialog";

const BRACKET_LABELS: Record<number, string> = {
  1: "B1",
  2: "B2",
  3: "B3",
  4: "B4",
  5: "B5",
};

export function DeckbuilderHeader({
  deck,
  commanderImg,
  onExport,
  onRefreshed,
}: {
  deck: DeckDetail;
  commanderImg: string | null;
  onExport: () => void;
  onRefreshed: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  const totalsTone =
    deck.totalCards === 100
      ? "text-emerald-700"
      : deck.totalCards > 100
        ? "text-rose-700"
        : "text-amber-700";

  const editable = {
    id: deck.deck.id,
    name: deck.deck.name,
    targetBracket: deck.deck.targetBracket,
    archetype: deck.deck.archetype,
    notes: deck.deck.notes,
    isPrimary: deck.deck.isPrimary,
    commander: deck.commander
      ? {
          printingId: deck.commander.printing.id,
          oracleId: deck.commander.oracleId,
          name: deck.commander.name,
          imageUri: commanderImg,
          oracleText: deck.commander.oracleText,
          colorIdentity: deck.commander.colorIdentity,
          typeLine: deck.commander.typeLine,
        }
      : null,
    partner: deck.partner
      ? {
          printingId: deck.partner.printing.id,
          oracleId: deck.partner.oracleId,
          name: deck.partner.name,
          imageUri:
            (deck.partner.printing.imageUris?.normal as string | undefined) ??
            null,
          oracleText: deck.partner.oracleText,
          colorIdentity: deck.partner.colorIdentity,
          typeLine: deck.partner.typeLine,
        }
      : null,
  };

  async function onDuplicate() {
    const res = await fetch(`/api/decks/${deck.deck.id}/duplicate`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/decks/${data.deck.id}`;
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${deck.deck.name}"? Cannot be undone.`)) return;
    const res = await fetch(`/api/decks/${deck.deck.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/decks";
  }

  return (
    <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {commanderImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={commanderImg}
            alt={deck.commander?.name ?? deck.deck.name}
            className="size-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImageOff className="size-4" />
          </div>
        )}
        <h1 className="text-base font-semibold tracking-tight">
          {deck.deck.name}
        </h1>
        {deck.colorIdentity.length > 0 ? (
          <ManaCost
            cost={deck.colorIdentity.map((c) => `{${c}}`).join("")}
            size="xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground">colorless</span>
        )}
        <div className="ml-2 flex items-center gap-3 text-xs">
          <span className={`font-semibold tabular-nums ${totalsTone}`}>
            {deck.totalCards}/100
          </span>
          <span className="tabular-nums text-muted-foreground">
            ${deck.totalValueUsd.toFixed(2)}
          </span>
          {deck.deck.targetBracket && (
            <Badge variant="secondary" className="text-[10px]">
              Target {BRACKET_LABELS[deck.deck.targetBracket]}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            Calculated —
          </Badge>
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2 text-sm hover:bg-muted">
              <MoreHorizontal className="size-4" />
              Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                Edit deck
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                Export decklist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                Delete deck
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditDeckDialog
        deck={editable}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) onRefreshed();
        }}
      />
    </div>
  );
}
