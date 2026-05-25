"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";

// Undo button for the transaction detail page. Mirrors the import-batch
// Undo affordance: confirmToast describes the inventory side-effects
// before commit, POST to the undo endpoint, navigate back to the
// ledger on success.

export function UndoTransactionButton({
  transactionId,
  kind,
  inCount,
  outCount,
}: {
  transactionId: string;
  kind: "purchase" | "sale" | "trade";
  inCount: number;
  outCount: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function run() {
    const inDesc =
      inCount > 0
        ? `${inCount} acquired card${inCount === 1 ? "" : "s"} will be removed from inventory`
        : null;
    const outDesc =
      outCount > 0
        ? `${outCount} disposed card${outCount === 1 ? "" : "s"} will be restored to inventory`
        : null;
    const description = [inDesc, outDesc].filter(Boolean).join(" · ");

    confirmToast(`Undo this ${kind}?`, {
      description: `${description}. The ledger entry itself is deleted. Any edits you made to the inventory rows (location, condition, notes) since the transaction will be lost. Refuses cleanly if any card has been disposed by a later transaction.`,
      confirmLabel: "Yes, undo",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const res = await fetch(
            `/api/transactions/${transactionId}/undo`,
            { method: "POST" },
          );
          const body = await res.json().catch(() => ({}));
          if (res.status === 409 && Array.isArray(body.conflicts)) {
            toast.error(
              `Can't undo — ${body.conflicts[0]}${body.conflicts.length > 1 ? ` (and ${body.conflicts.length - 1} more)` : ""}. Undo the later transaction first.`,
            );
            return;
          }
          if (!res.ok) {
            throw new Error(body.error ?? `HTTP ${res.status}`);
          }
          toast.success(
            `Undone — ${body.deleted ?? 0} removed, ${body.restored ?? 0} restored.`,
          );
          router.push("/trades");
          router.refresh();
        } catch (err) {
          toast.error(
            `Undo failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={submitting}
      className="gap-1.5"
    >
      <Undo2 className="size-3.5" />
      {submitting ? "Undoing…" : "Undo"}
    </Button>
  );
}
