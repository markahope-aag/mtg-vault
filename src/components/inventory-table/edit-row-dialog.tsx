"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/inventory/schemas";
import type { InventoryRowWithCard } from "@/lib/inventory/types";

type FormState = {
  foil: boolean;
  etched: boolean;
  condition: (typeof CONDITIONS)[number];
  language: string;
  location: string;
  physicalId: string;
  acquiredPrice: string;
  acquiredAt: string;
  purchasedFrom: string;
  gradingCompany: string;
  grade: string;
  notes: string;
};

function fromRow(row: InventoryRowWithCard): FormState {
  return {
    foil: row.foil,
    etched: row.etched,
    condition: (CONDITIONS.includes(row.condition as (typeof CONDITIONS)[number])
      ? row.condition
      : "NM") as (typeof CONDITIONS)[number],
    language: row.language,
    location: row.location ?? "",
    physicalId: row.physicalId ?? "",
    acquiredPrice: row.acquiredPrice ?? "",
    acquiredAt: row.acquiredAt
      ? new Date(row.acquiredAt).toISOString().slice(0, 10)
      : "",
    purchasedFrom: row.purchasedFrom ?? "",
    gradingCompany: row.gradingCompany ?? "",
    grade: row.grade ?? "",
    notes: row.notes ?? "",
  };
}

export function EditRowDialog({
  row,
  open,
  onOpenChange,
}: {
  row: InventoryRowWithCard | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && row) setForm(fromRow(row));
  }, [open, row]);

  if (!row || !form) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row || !form) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          foil: form.foil,
          etched: form.etched,
          condition: form.condition,
          language: form.language,
          location: form.location || null,
          physicalId: form.physicalId || null,
          acquiredPrice: form.acquiredPrice || null,
          acquiredAt: form.acquiredAt || null,
          purchasedFrom: form.purchasedFrom || null,
          gradingCompany: form.gradingCompany || null,
          grade: form.grade || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      toast.success("Updated");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to update: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit row</DialogTitle>
          <DialogDescription>
            {row.name} · {row.setName} ({row.setCode.toUpperCase()})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Condition">
              <Select
                value={form.condition}
                onValueChange={(v) =>
                  update("condition", v as (typeof CONDITIONS)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} — {CONDITION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Language">
              <Input
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CheckboxField
              checked={form.foil}
              onChange={(v) => update("foil", v)}
              label="Foil"
            />
            <CheckboxField
              checked={form.etched}
              onChange={(v) => update("etched", v)}
              label="Etched"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </Field>
            <Field label="Physical ID">
              <Input
                value={form.physicalId}
                onChange={(e) => update("physicalId", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Acquired price">
              <Input
                type="number"
                step="0.01"
                value={form.acquiredPrice}
                onChange={(e) => update("acquiredPrice", e.target.value)}
              />
            </Field>
            <Field label="Acquired at">
              <Input
                type="date"
                value={form.acquiredAt}
                onChange={(e) => update("acquiredAt", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Purchased from">
            <Input
              value={form.purchasedFrom}
              onChange={(e) => update("purchasedFrom", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Grading company">
              <Input
                value={form.gradingCompany}
                onChange={(e) => update("gradingCompany", e.target.value)}
              />
            </Field>
            <Field label="Grade">
              <Input
                value={form.grade}
                onChange={(e) => update("grade", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-input"
      />
      {label}
    </label>
  );
}
