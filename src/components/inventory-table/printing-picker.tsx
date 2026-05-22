"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SetSymbol } from "@/components/set-symbol";

export type PrintingOption = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
};

/**
 * Filterable printing list with set symbols. Shared by the Add and Edit
 * inventory dialogs. Basic lands have hundreds of printings, so the filter
 * (set name / code / collector #) shows once a card has more than 8.
 */
export function PrintingPicker({
  printings,
  selectedId,
  onSelect,
}: {
  printings: PrintingOption[];
  selectedId: string;
  onSelect: (printing: PrintingOption) => void;
}) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return printings;
    return printings.filter(
      (p) =>
        p.setName.toLowerCase().includes(q) ||
        p.setCode.toLowerCase().includes(q) ||
        p.collectorNumber.toLowerCase().includes(q),
    );
  }, [printings, filter]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Printing</Label>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {printings.length}
        </span>
      </div>
      {printings.length > 8 && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by set name, code, or collector #…"
          className="h-8 text-sm"
        />
      )}
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No printings match &ldquo;{filter.trim()}&rdquo;.
          </p>
        ) : (
          visible.map((p) => {
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className={`flex w-full items-center justify-between gap-3 border-b px-3 py-1.5 text-left text-sm last:border-b-0 ${
                  selected ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="radio"
                    checked={selected}
                    readOnly
                    tabIndex={-1}
                  />
                  <SetSymbol setCode={p.setCode} rarity={p.rarity} size="md" />
                  <span className="font-medium">{p.setName}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {p.setCode}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{p.collectorNumber}
                  </span>
                  {p.rarity && (
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {p.rarity}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                  <span>{p.usd ? `$${p.usd}` : "—"}</span>
                  <span className="text-muted-foreground">
                    {p.usdFoil ? `${p.usdFoil} foil` : ""}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
