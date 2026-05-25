"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Kind } from "./types";

const KIND_DESCRIPTIONS: Record<Kind, string> = {
  purchase: "Cards in for cash out.",
  sale: "Cards out for cash in.",
  trade: "Both, with optional cash either side.",
};

export function KindSelector({
  kind,
  onChange,
}: {
  kind: Kind;
  onChange: (next: Kind) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Kind
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["purchase", "sale", "trade"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${
                kind === k
                  ? "border-[var(--brand)] bg-[var(--color-brand-soft)]/30"
                  : "border-border-subtle hover:border-border-strong"
              }`}
            >
              <p className="font-medium capitalize">{k}</p>
              <p className="mt-1 text-xs text-text-muted">
                {KIND_DESCRIPTIONS[k]}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
