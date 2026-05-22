"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type SelectionCard = { printingId: string; quantity: number };

/**
 * Names and creates a new deck from a set of inventory-selected printings.
 * Printings are already deduped by the caller (Commander singletons capped
 * at 1, basic lands keep their selected count).
 */
export function CreateDeckFromSelectionDialog({
  open,
  onOpenChange,
  cards,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cards: SelectionCard[];
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const distinct = cards.length;
  const total = cards.reduce((s, c) => s + c.quantity, 0);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(`New deck — ${distinct} card${distinct === 1 ? "" : "s"}`);
    }
  }, [open, distinct]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || cards.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/decks/from-selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), cards }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`Created ${name.trim()} with ${data.added} cards`);
      onOpenChange(false);
      onCreated?.();
      router.push(`/decks/${data.deck.id}`);
    } catch (err) {
      toast.error(
        `Couldn't create deck: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create deck from selection</DialogTitle>
          <DialogDescription>
            {distinct} distinct printing{distinct === 1 ? "" : "s"}
            {total !== distinct ? ` (${total} cards)` : ""} → main board. Set a
            commander afterward in the builder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-deck-name">Deck name</Label>
            <Input
              id="new-deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create deck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
