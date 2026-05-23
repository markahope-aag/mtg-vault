"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LocationRow = { id: string; name: string; usedBy: number };

export function LocationsManager() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setRows(data.locations ?? []);
    } catch {
      toast.error("Couldn't load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // refetch updates rows/loading inside; this initial call is the intended
    // trigger on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  const onAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const v = name.trim();
      if (!v) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/locations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: v }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setName("");
        toast.success(`Added "${v}"`);
        await refetch();
      } catch (err) {
        toast.error(
          `Couldn't add: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [name, refetch],
  );

  const onDelete = useCallback(
    async (row: LocationRow) => {
      const tail =
        row.usedBy > 0
          ? ` This will clear the location from ${row.usedBy} inventory card${row.usedBy === 1 ? "" : "s"}.`
          : "";
      if (!window.confirm(`Delete "${row.name}"?${tail}`)) {
        return;
      }
      setDeleting(row.id);
      try {
        const res = await fetch(`/api/locations/${row.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const cleared = data?.cleared ?? 0;
        toast.success(
          cleared > 0
            ? `Deleted "${row.name}" · cleared ${cleared} card${cleared === 1 ? "" : "s"}`
            : `Deleted "${row.name}"`,
        );
        await refetch();
      } catch (err) {
        toast.error(
          `Couldn't delete: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setDeleting(null);
      }
    },
    [refetch],
  );

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New location name…"
          maxLength={80}
          className="h-9 max-w-xs"
        />
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !name.trim()}
          className="h-9 gap-1.5"
        >
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Add location
        </Button>
      </form>

      {loading ? (
        <p className="empty-terminal">loading</p>
      ) : rows.length === 0 ? (
        <p className="empty-terminal">no locations</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[var(--text-primary)]">
                  {r.name}
                </span>
                <span className="num shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  {r.usedBy} card{r.usedBy === 1 ? "" : "s"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void onDelete(r)}
                disabled={deleting === r.id}
                aria-label={`Delete ${r.name}`}
                className="inline-flex h-7 items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-2 font-mono text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:border-[var(--value-negative)]/50 hover:text-[var(--value-negative)] disabled:opacity-50"
              >
                {deleting === r.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
