"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Kind } from "./types";

// Live preview of what the server's allocation will look like. Shows
// out / in totals from per-line overrides and flags when the user's
// overrides don't match the cash leg (the server will fill the gap
// automatically, but the user should know it's about to).

export type AllocationPreviewData = {
  inTotal: number;
  outTotal: number;
  cashOutNum: number;
  cashInNum: number;
};

export function AllocationPreview({
  preview,
  kind,
  showOut,
  showIn,
  submitting,
}: {
  preview: AllocationPreviewData;
  kind: Kind;
  showOut: boolean;
  showIn: boolean;
  submitting: boolean;
}) {
  const purchaseDrift =
    kind === "purchase" &&
    Math.abs(preview.inTotal - preview.cashOutNum) > 0.01 &&
    preview.cashOutNum > 0;
  const saleDrift =
    kind === "sale" &&
    Math.abs(preview.outTotal - preview.cashInNum) > 0.01 &&
    preview.cashInNum > 0;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-4 font-mono uppercase text-xs">
          {showOut && (
            <span>
              <span className="text-text-muted">Out lines: </span>
              <span className="tabular-nums text-[var(--value-negative)]">
                ${preview.outTotal.toFixed(2)}
              </span>
            </span>
          )}
          {showIn && (
            <span>
              <span className="text-text-muted">In lines: </span>
              <span className="tabular-nums text-[var(--value-positive)]">
                ${preview.inTotal.toFixed(2)}
              </span>
            </span>
          )}
          {purchaseDrift && (
            <span className="text-amber-500">
              Override sum ≠ cash out — the server will auto-allocate the
              remainder.
            </span>
          )}
          {saleDrift && (
            <span className="text-amber-500">
              Override sum ≠ cash in — the server will auto-allocate the
              remainder.
            </span>
          )}
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log transaction"}
        </Button>
      </CardContent>
    </Card>
  );
}
