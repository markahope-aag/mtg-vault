"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UndoBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (
      !window.confirm(
        "Undo this batch? All rows it inserted will be deleted. If the batch ran in replace_location mode, the rows it disposed will be restored.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/import/batches/${batchId}/undo`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(
        `Undid batch — deleted ${data.deleted} rows${data.restored ? `, restored ${data.restored}` : ""}.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to undo: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      disabled={busy}
      className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {busy ? "…" : "Undo"}
    </Button>
  );
}
