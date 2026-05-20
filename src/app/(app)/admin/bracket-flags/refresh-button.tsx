"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshBracketFlagsAction } from "./actions";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function onClick() {
    setBusy(true);
    start(async () => {
      const result = await refreshBracketFlagsAction();
      if (result.ok) {
        const errCount = result.summary.errors.length;
        toast[errCount ? "warning" : "success"](
          errCount
            ? `Refresh completed with ${errCount} error(s) — see admin page.`
            : `Refresh complete. GC ${result.summary.gameChangerCount} · Tutor ${result.summary.tutorCount} · MLD ${result.summary.mldCount} · ExtraTurn ${result.summary.extraTurnCount}`,
        );
      } else {
        toast.error(`Refresh failed: ${result.error}`);
      }
      setBusy(false);
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={busy || pending} size="sm">
      {busy || pending ? "Refreshing…" : "Refresh now"}
    </Button>
  );
}
