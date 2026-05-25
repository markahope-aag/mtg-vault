"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Source } from "./types";

export function SourceRow({ source }: { source: Source }) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);

  const toggle = useCallback(
    async (
      field: "enabled" | "robotsAcknowledged" | "useWebUnlocker",
      value: boolean,
    ) => {
      try {
        const res = await fetch("/api/admin/market-sources", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: source.id, [field]: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        toast.success("Updated");
        router.refresh();
      } catch (err) {
        toast.error(
          `Couldn't update: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [source.id, router],
  );

  const testFetch = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch(
        `/api/admin/market-sources/${source.id}/test`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.ok) {
        toast.success(body.message);
      } else {
        toast.warning(body.message);
      }
      router.refresh();
    } catch (err) {
      toast.error(
        `Test failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setTesting(false);
    }
  }, [source.id, router]);

  const onDelete = useCallback(() => {
    confirmToast(`Delete "${source.displayName}"?`, {
      description:
        "Removes the source config. Cached listings from this source stay in market_listings but won't refresh.",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `/api/admin/market-sources?id=${source.id}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success("Source deleted");
          router.refresh();
        } catch (err) {
          toast.error(
            `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });
  }, [source.id, source.displayName, router]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {source.displayName}{" "}
              <span className="ml-2 font-mono text-[10px] uppercase text-text-muted">
                {source.sourceKey} · {source.parserTemplate}
              </span>
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
              {source.baseUrl}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
              source.enabled
                ? "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10 text-[var(--value-positive)]"
                : "border-border-subtle bg-surface-inset text-text-muted",
            )}
          >
            {source.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.robotsAcknowledged}
              onChange={(e) => toggle("robotsAcknowledged", e.target.checked)}
            />
            <span>Robots/terms acknowledged</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.enabled}
              disabled={!source.robotsAcknowledged}
              onChange={(e) => toggle("enabled", e.target.checked)}
            />
            <span>Enabled (requires acknowledgment)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.useWebUnlocker}
              onChange={(e) => toggle("useWebUnlocker", e.target.checked)}
            />
            <span>Use Bright Data Web Unlocker</span>
          </label>
          <div className="font-mono text-[10px] uppercase text-text-muted">
            Rate limit: {source.rateLimitPerMinute}/min ·{" "}
            {source.rateLimitPerDay}/day
          </div>
        </div>

        {source.termsNotes && (
          <div className="rounded-md border border-border-subtle bg-surface-inset/40 p-2 text-[11px] text-text-secondary">
            <p className="font-mono uppercase tracking-wide text-text-muted">
              Terms notes
            </p>
            <p className="mt-0.5">{source.termsNotes}</p>
          </div>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap gap-3 font-mono uppercase text-text-muted">
            <span>
              Last run:{" "}
              {source.lastRunAt
                ? new Date(source.lastRunAt).toLocaleString()
                : "never"}
            </span>
            <span>
              Last test:{" "}
              {source.lastTestAt ? (
                <span
                  className={
                    source.lastTestOk
                      ? "text-[var(--value-positive)]"
                      : "text-[var(--value-negative)]"
                  }
                >
                  {new Date(source.lastTestAt).toLocaleString()}
                </span>
              ) : (
                "never"
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={testFetch}
              disabled={testing}
            >
              <Zap className="size-3" /> {testing ? "Testing…" : "Test fetch"}
            </Button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)]"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {source.lastTestMessage && (
          <p className="text-[11px] italic text-text-muted">
            Last test: {source.lastTestMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
