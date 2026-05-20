"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InventoryRowWithCard } from "@/lib/inventory/types";
import { currentValueOf } from "@/lib/inventory/types";
import {
  AddCardsDialog,
  type AddDialogCard,
} from "@/components/inventory-table/add-cards-dialog";
import { EditRowDialog } from "@/components/inventory-table/edit-row-dialog";
import { DisposeDialog } from "@/components/inventory-table/dispose-dialog";

type Group = {
  key: string;
  printingId: string;
  setName: string;
  setCode: string;
  foil: boolean;
  etched: boolean;
  condition: string;
  rows: InventoryRowWithCard[];
  totalValue: number;
};

export function OwnershipPanel({
  card,
  ownedRows,
}: {
  card: AddDialogCard;
  ownedRows: InventoryRowWithCard[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<InventoryRowWithCard | null>(null);
  const [disposingRows, setDisposingRows] = useState<InventoryRowWithCard[]>([]);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const r of ownedRows) {
      const key = `${r.printingId}|${r.foil ? "f" : "n"}|${r.etched ? "e" : "n"}|${r.condition}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          printingId: r.printingId,
          setName: r.setName,
          setCode: r.setCode,
          foil: r.foil,
          etched: r.etched,
          condition: r.condition,
          rows: [],
          totalValue: 0,
        };
        map.set(key, g);
      }
      g.rows.push(r);
      g.totalValue += currentValueOf(r);
    }
    return [...map.values()].sort((a, b) =>
      a.setName.localeCompare(b.setName),
    );
  }, [ownedRows]);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Deleted");
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const total = ownedRows.length;
  const totalValue = ownedRows.reduce((s, r) => s + currentValueOf(r), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">You own</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add to inventory
        </Button>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not in your inventory.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {total} physical card{total === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                ${totalValue.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1 rounded-md border">
              {groups.map((g) => {
                const isOpen = expanded.has(g.key);
                return (
                  <div key={g.key} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.key)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        )}
                        <span className="font-medium">×{g.rows.length}</span>
                        <span>{g.setName}</span>
                        <span className="text-xs uppercase text-muted-foreground">
                          {g.setCode}
                        </span>
                        {g.foil && (
                          <Badge variant="secondary" className="text-[10px]">
                            foil
                          </Badge>
                        )}
                        {g.etched && (
                          <Badge variant="secondary" className="text-[10px]">
                            etched
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {g.condition}
                        </Badge>
                      </div>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        ${g.totalValue.toFixed(2)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-1 bg-muted/20 px-3 py-2">
                        {g.rows.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/40"
                          >
                            <div className="min-w-0 flex-1 truncate">
                              <span className="text-muted-foreground">
                                {r.location ?? "—"}
                              </span>
                              {r.physicalId && (
                                <span className="ml-2 text-muted-foreground">
                                  · #{r.physicalId}
                                </span>
                              )}
                              {r.purchasedFrom && (
                                <span className="ml-2 text-muted-foreground">
                                  · {r.purchasedFrom}
                                </span>
                              )}
                            </div>
                            <span className="tabular-nums text-muted-foreground">
                              ${currentValueOf(r).toFixed(2)}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                                <MoreHorizontal className="size-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => setEditingRow(r)}
                                >
                                  <Pencil className="size-3.5" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDisposingRows([r]);
                                    setDisposeOpen(true);
                                  }}
                                >
                                  <Trash2 className="size-3.5" /> Mark disposed
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => onDelete(r.id)}
                                >
                                  <Trash2 className="size-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <AddCardsDialog
        card={card}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <EditRowDialog
        row={editingRow}
        open={editingRow !== null}
        onOpenChange={(v) => !v && setEditingRow(null)}
      />
      <DisposeDialog
        rows={disposingRows}
        open={disposeOpen}
        onOpenChange={(v) => {
          setDisposeOpen(v);
          if (!v) setDisposingRows([]);
        }}
      />
    </Card>
  );
}
