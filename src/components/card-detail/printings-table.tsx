"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SetSymbol } from "@/components/set-symbol";

export type PrintingRow = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  releasedAt: string | null;
};

export function PrintingsTable({
  oracleId,
  printings,
  selectedId,
}: {
  oracleId: string;
  printings: PrintingRow[];
  selectedId: string | undefined;
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
    <div>
      {printings.length > 8 && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by set name, code, or collector #…"
            className="h-8 text-sm"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {visible.length} of {printings.length}
          </span>
        </div>
      )}
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium">Set</th>
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Rarity</th>
              <th className="px-2 py-2 text-right font-medium">USD</th>
              <th className="px-2 py-2 text-right font-medium">USD foil</th>
              <th className="px-4 py-2 text-right font-medium">Released</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-xs text-muted-foreground"
                >
                  No printings match &ldquo;{filter.trim()}&rdquo;.
                </td>
              </tr>
            ) : (
              visible.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <tr
                    key={p.id}
                    className={
                      isSelected
                        ? "border-b bg-muted/60"
                        : "border-b hover:bg-muted/40"
                    }
                  >
                    <td className="px-4 py-1.5">
                      <Link
                        href={`/cards/${oracleId}?printing=${p.id}`}
                        scroll={false}
                        replace
                        className="flex items-center gap-2"
                      >
                        <SetSymbol
                          setCode={p.setCode}
                          rarity={p.rarity}
                          size="md"
                        />
                        <span className="font-medium">{p.setName}</span>
                        <span className="text-xs uppercase text-muted-foreground">
                          {p.setCode}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {p.collectorNumber}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.rarity && (
                        <Badge variant="outline" className="capitalize">
                          {p.rarity}
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {p.usd ? `$${p.usd}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {p.usdFoil ? `$${p.usdFoil}` : "—"}
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                      {p.releasedAt
                        ? new Date(p.releasedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
