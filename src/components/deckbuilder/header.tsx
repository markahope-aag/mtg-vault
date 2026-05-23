"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { pickCardImage } from "@/lib/card-image";
import { confirmToast } from "@/lib/confirm-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColorIdentityPips } from "@/components/mana-cost";
import { BracketBadge } from "@/components/bracket-badge";
import type { DeckDetail } from "@/lib/decks/types";
import { EditDeckDialog } from "@/components/decks/edit-deck-dialog";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export function DeckbuilderHeader({
  deck,
  commanderImg,
  onExport,
  onRefreshed,
  onOpenBracket,
}: {
  deck: DeckDetail;
  commanderImg: string | null;
  onExport: () => void;
  onRefreshed: () => void;
  onOpenBracket?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [calculatedBracket, setCalculatedBracket] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deck.deck.id}/snapshots`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { snapshots?: Array<{ calculatedBracket: number | null }> }) => {
        if (cancelled || !d?.snapshots?.length) return;
        const latest = d.snapshots[0];
        setCalculatedBracket(latest.calculatedBracket);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deck.deck.id, deck.deck.updatedAt]);

  // N/100 — the critical feedback signal. Green when exactly 100, amber when
  // below, red when over.
  const totalsTone =
    deck.totalCards === 100
      ? "text-[var(--color-value-positive)]"
      : deck.totalCards > 100
        ? "text-[var(--color-value-negative)]"
        : "text-[var(--color-bracket-3)]";

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
          imageUri: pickCardImage(
            deck.partner.printing.imageUris,
            deck.partner.printing.cardFaces,
            "normal",
          ),
          oracleText: deck.partner.oracleText,
          colorIdentity: deck.partner.colorIdentity,
          typeLine: deck.partner.typeLine,
        }
      : null,
  };

  async function onDuplicate() {
    try {
      const res = await fetch(`/api/decks/${deck.deck.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      window.location.href = `/decks/${data.deck.id}`;
    } catch (err) {
      toast.error(
        `Failed to duplicate: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function onDelete() {
    confirmToast(`Delete "${deck.deck.name}"?`, {
      description: "Cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/decks/${deck.deck.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          window.location.href = "/decks";
        } catch (err) {
          toast.error(
            `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });
  }

  const overTarget =
    deck.deck.targetBracket != null &&
    calculatedBracket != null &&
    calculatedBracket > deck.deck.targetBracket;

  return (
    <div className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2">
        <BackLink href="/decks" label="Decks" className="shrink-0" />
        <span className="h-4 w-px bg-border-subtle" />
        <ImgWithFallback
          src={commanderImg}
          alt={deck.commander?.name ?? deck.deck.name}
          className="size-8 shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
          fallbackClassName="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-inset text-text-muted ring-1 ring-border-subtle"
          fallbackIconClassName="size-3.5"
        />


        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary">
            {deck.deck.name}
          </h1>
          {deck.commander && (
            <p className="truncate font-mono text-[10px] uppercase tracking-wide text-text-muted">
              {deck.commander.name}
              {deck.partner && ` · ${deck.partner.name}`}
            </p>
          )}
        </div>

        <span className="mx-1 hidden h-7 w-px bg-border-subtle sm:block" />

        <ColorIdentityPips
          identity={deck.colorIdentity}
          size="xs"
          className="shrink-0"
        />

        <div className="ml-auto flex items-center gap-4 font-mono text-[12px]">
          {/* N/100 — the critical feedback. */}
          <div className="flex items-baseline gap-1">
            <span
              className={cn("font-semibold tabular-nums", totalsTone)}
              aria-label={`${deck.totalCards} of 100 cards`}
            >
              {deck.totalCards}
              <span className="opacity-60">/100</span>
            </span>
          </div>

          <span className="hidden tabular-nums text-text-muted sm:inline">
            ${deck.totalValueUsd.toFixed(2)}
          </span>

          <span className="hidden h-4 w-px bg-border-subtle sm:block" />

          <div className="hidden items-center gap-1.5 sm:flex">
            <BracketBadge bracket={deck.deck.targetBracket} prefix="Target" />
            <button
              type="button"
              onClick={onOpenBracket}
              className="group inline-flex items-center transition-opacity hover:opacity-80"
              title={
                calculatedBracket == null
                  ? "Press ⌘B to calculate"
                  : "Open bracket panel"
              }
            >
              <BracketBadge
                bracket={calculatedBracket}
                prefix="Calc"
                className={cn(
                  "transition-colors",
                  overTarget && "ring-1 ring-[var(--color-bracket-3)]/40",
                )}
              />
              {overTarget && (
                <span
                  className="ml-1 inline-block size-1.5 rounded-full bg-[var(--color-bracket-3)]"
                  aria-label="Over target bracket"
                />
              )}
            </button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="ml-1 inline-flex h-7 items-center gap-1 rounded-md border border-border-subtle bg-surface-raised px-2 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            aria-label="Deck actions"
          >
            <MoreHorizontal className="size-3.5" />
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
