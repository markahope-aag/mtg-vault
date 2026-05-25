"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Generic "recompute + refresh" button for the panels that hang off
// /decks/[id]/command. POSTs to a fire-and-forget endpoint (bracket /
// analyze / etc.), then router.refresh() so the server component re-
// reads the now-updated cache. Shows last-computed timestamp.
export function RecalcButton({
  endpoint,
  method = "POST",
  lastAt,
  label,
  pendingLabel,
}: {
  // deckId is implicit in `endpoint` (callers pass /api/decks/[id]/...);
  // keeping the prop signature without an unused field.
  deckId: string;
  endpoint: string;
  method?: "POST" | "GET";
  lastAt: string | null;
  label: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      const res = await fetch(endpoint, { method });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`${label} done`);
      router.refresh();
    } catch (err) {
      toast.error(
        `${label} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {lastAt && (
        <span className="font-mono text-[10px] uppercase text-text-muted">
          {new Date(lastAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={pending}
      >
        <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} />
        {pending ? (pendingLabel ?? "Working…") : label}
      </Button>
    </div>
  );
}
