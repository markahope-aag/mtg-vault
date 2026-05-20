"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DeckFormFields,
  deckFormToPayload,
  type DeckFormState,
} from "./deck-form";
import type { CommanderPick } from "./commander-search";

export type EditableDeck = {
  id: string;
  name: string;
  targetBracket: number | null;
  archetype: string | null;
  notes: string | null;
  isPrimary: boolean;
  commander: CommanderPick | null;
  partner: CommanderPick | null;
};

export function EditDeckDialog({
  deck,
  open,
  onOpenChange,
}: {
  deck: EditableDeck;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<DeckFormState>(() => fromDeck(deck));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setForm(fromDeck(deck));
  }, [open, deck]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deckFormToPayload(form)),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      toast.success("Saved");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit deck</DialogTitle>
          <DialogDescription>{deck.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <DeckFormFields form={form} onChange={setForm} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !form.name.trim()}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fromDeck(d: EditableDeck): DeckFormState {
  return {
    name: d.name,
    commander: d.commander,
    partner: d.partner,
    targetBracket: d.targetBracket,
    archetype: d.archetype ?? "",
    notes: d.notes ?? "",
    isPrimary: d.isPrimary,
  };
}
