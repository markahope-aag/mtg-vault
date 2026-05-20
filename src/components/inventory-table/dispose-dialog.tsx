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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { currentValueOf } from "@/lib/inventory/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DisposeDialog({
  rows,
  open,
  onOpenChange,
}: {
  rows: InventoryRowWithCard[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [disposedTo, setDisposedTo] = useState("");
  const [disposedPrice, setDisposedPrice] = useState("");
  const [disposedAt, setDisposedAt] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const total = rows.reduce((s, r) => s + currentValueOf(r), 0);
    /* eslint-disable react-hooks/set-state-in-effect */
    setDisposedTo("");
    setDisposedPrice(rows.length === 1 ? total.toFixed(2) : "");
    setDisposedAt(todayIso());
    setNotes("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, rows]);

  if (rows.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const totalValue = rows.reduce((s, r) => s + currentValueOf(r), 0);
  const isBulk = rows.length > 1;
  const singleRow = rows[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!disposedTo.trim()) return;
    setSubmitting(true);
    try {
      // For bulk disposal: split the entered price evenly across rows if provided.
      const priceEach =
        disposedPrice && rows.length > 0
          ? (Number.parseFloat(disposedPrice) / rows.length).toFixed(2)
          : null;

      const results = await Promise.allSettled(
        rows.map((row) =>
          fetch(`/api/inventory/${row.id}/dispose`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              disposedTo: disposedTo.trim(),
              disposedPrice: priceEach,
              disposedAt: disposedAt || null,
              notes: notes || null,
            }),
          }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(
          isBulk
            ? `Marked ${rows.length} cards as disposed to ${disposedTo}`
            : `Marked ${singleRow.name} (${singleRow.setCode.toUpperCase()}) as disposed to ${disposedTo}${disposedPrice ? ` for $${disposedPrice}` : ""}`,
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(`${failed} of ${rows.length} disposals failed`);
      }
    } catch (err) {
      toast.error(
        `Failed to dispose: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isBulk
              ? `Dispose ${rows.length} cards`
              : `Dispose ${singleRow.name}`}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Total value: $${totalValue.toFixed(2)}`
              : `${singleRow.setName} (${singleRow.setCode.toUpperCase()}) · ${singleRow.condition} · current value $${currentValueOf(singleRow).toFixed(2)}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Disposed to
            </Label>
            <Input
              required
              value={disposedTo}
              onChange={(e) => setDisposedTo(e.target.value)}
              placeholder="TCGPlayer, traded to X, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {isBulk ? "Total price received" : "Price"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={disposedPrice}
                onChange={(e) => setDisposedPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Disposed at
              </Label>
              <Input
                type="date"
                value={disposedAt}
                onChange={(e) => setDisposedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            <Button type="submit" disabled={submitting || !disposedTo.trim()}>
              {submitting ? "Disposing…" : "Mark as disposed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
