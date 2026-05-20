"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EditDeckDialog,
  type EditableDeck,
} from "./edit-deck-dialog";

export function DeckDetailActions({ deck }: { deck: EditableDeck }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(`Duplicated as "${data.deck.name}"`);
      router.push(`/decks/${data.deck.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to duplicate: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Delete "${deck.name}"? This permanently removes the deck and its card slots. Cards in your inventory are NOT affected — only the deck list is removed. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      toast.success("Deleted");
      router.push("/decks");
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setEditOpen(true)}
        disabled={busy}
      >
        <Pencil className="size-4" /> Edit
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDuplicate}
        disabled={busy}
      >
        <Copy className="size-4" /> Duplicate
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDelete}
        disabled={busy}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" /> Delete
      </Button>
      <EditDeckDialog
        deck={deck}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
