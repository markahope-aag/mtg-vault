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
  defaultDeckForm,
  deckFormToPayload,
  type DeckFormState,
} from "./deck-form";

export function NewDeckDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<DeckFormState>(() => defaultDeckForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setForm(defaultDeckForm());
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deckFormToPayload(form)),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const fields = detail?.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fields
          ? Object.entries(fields).find(([, msgs]) => msgs?.length)
          : null;
        const fieldHint = firstField
          ? ` (${firstField[0]}: ${firstField[1].join(", ")})`
          : "";
        throw new Error(`${detail.error ?? `HTTP ${res.status}`}${fieldHint}`);
      }
      const data = await res.json();
      toast.success(`Created ${data.deck.name}`);
      onOpenChange(false);
      router.push(`/decks/${data.deck.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to create deck: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New deck</DialogTitle>
          <DialogDescription>
            Commander can be assigned later if you&rsquo;re still deciding.
          </DialogDescription>
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
              {submitting ? "Creating…" : "Create deck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
