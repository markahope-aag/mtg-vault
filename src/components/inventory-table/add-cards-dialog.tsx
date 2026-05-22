"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { SetSymbol } from "@/components/set-symbol";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/inventory/schemas";

export type AddDialogPrinting = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  releasedAt: string | Date | null;
};

export type AddDialogCard = {
  oracleId: string;
  name: string;
  printings: AddDialogPrinting[];
};

type FormState = {
  printingId: string;
  count: number;
  foil: boolean;
  etched: boolean;
  condition: (typeof CONDITIONS)[number];
  language: string;
  location: string;
  physicalId: string;
  acquiredPrice: string;
  acquiredAt: string; // YYYY-MM-DD
  purchasedFrom: string;
  gradingCompany: string;
  grade: string;
  notes: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(card: AddDialogCard | null): FormState {
  const printing = card?.printings[0];
  return {
    printingId: printing?.id ?? "",
    count: 1,
    foil: false,
    etched: false,
    condition: "NM",
    language: "en",
    location: "",
    physicalId: "",
    acquiredPrice: printing?.usd ?? "",
    acquiredAt: todayIso(),
    purchasedFrom: "",
    gradingCompany: "",
    grade: "",
    notes: "",
  };
}

export function AddCardsDialog({
  card,
  open,
  onOpenChange,
  onAdded,
}: {
  card: AddDialogCard | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => defaultForm(card));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setForm(defaultForm(card));
  }, [open, card]);

  const printing = useMemo(
    () => card?.printings.find((p) => p.id === form.printingId) ?? null,
    [card, form.printingId],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card || !printing) return;
    if (form.count < 1) return;
    setSubmitting(true);
    try {
      const rows = Array.from({ length: form.count }, () => ({
        printingId: form.printingId,
        foil: form.foil,
        etched: form.etched,
        condition: form.condition,
        language: form.language,
        location: form.location || null,
        physicalId: form.count === 1 ? form.physicalId || null : null,
        acquiredPrice: form.acquiredPrice || null,
        acquiredAt: form.acquiredAt || null,
        purchasedFrom: form.purchasedFrom || null,
        gradingCompany: form.gradingCompany || null,
        grade: form.grade || null,
        notes: form.notes || null,
      }));
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        // Surface zod field-level errors when available so "Invalid payload"
        // doesn't hide the actual cause.
        const fields = detail?.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fields
          ? Object.entries(fields).find(([, msgs]) => msgs?.length)
          : null;
        const fieldHint = firstField
          ? ` (${firstField[0]}: ${firstField[1].join(", ")})`
          : "";
        throw new Error(`${detail.error ?? `HTTP ${res.status}`}${fieldHint}`);
      }
      toast.success(
        `Added ${form.count}× ${card.name} (${printing.setCode.toUpperCase()})${
          form.location ? ` to ${form.location}` : ""
        }`,
      );
      onOpenChange(false);
      // Let the parent (e.g. InventoryTable) refetch its client-held rows.
      // router.refresh() alone won't update a client component that owns its
      // own state.
      onAdded?.();
      router.refresh();
    } catch (err) {
      toast.error(
        `Failed to add cards: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // disablePointerDismissal: form contains in-progress user input — don't
    // dismiss on a stray click outside. Esc and the Cancel button still close it.
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to inventory</DialogTitle>
          <DialogDescription>
            {card?.name ?? "Select a card first."}
          </DialogDescription>
        </DialogHeader>

        {!card ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Open a card detail page and click &ldquo;Add to inventory&rdquo; to
            pre-select a card.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Printing picker */}
            <div className="space-y-2">
              <Label>Printing</Label>
              <div className="max-h-44 overflow-y-auto rounded-md border">
                {card.printings.map((p) => {
                  const selected = p.id === form.printingId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        update("printingId", p.id);
                        const target = form.foil ? p.usdFoil : p.usd;
                        if (target) update("acquiredPrice", target);
                      }}
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
                        <SetSymbol
                          setCode={p.setCode}
                          rarity={p.rarity}
                          size="md"
                        />
                        <span className="font-medium">{p.setName}</span>
                        <span className="text-xs uppercase text-muted-foreground">
                          {p.setCode}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{p.collectorNumber}
                        </span>
                        {p.rarity && (
                          <Badge variant="outline" className="text-[10px] capitalize">
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
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-4">
              <Field label="Count">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={form.count}
                  onChange={(e) =>
                    update("count", Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </Field>
              <Field label="Condition">
                <Select
                  value={form.condition}
                  onValueChange={(v) =>
                    update("condition", v as (typeof CONDITIONS)[number])
                  }
                >
                  <SelectTrigger className="w-full">
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
            </div>

            <div className="grid grid-cols-2 items-center gap-4 rounded-md border border-border bg-muted/30 px-3 py-2">
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

            <div className="grid grid-cols-2 items-end gap-4">
              <Field label="Language">
                <Input
                  value={form.language}
                  onChange={(e) => update("language", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="Long box 1"
                />
              </Field>
            </div>

            {form.count === 1 && (
              <Field label="Physical ID">
                <Input
                  value={form.physicalId}
                  onChange={(e) => update("physicalId", e.target.value)}
                  placeholder="Sleeve number, barcode, etc."
                />
              </Field>
            )}

            <div className="grid grid-cols-2 items-end gap-4">
              <Field label="Acquired price">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
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
                placeholder="Card Kingdom, LGS, trade with X, …"
              />
            </Field>

            <div className="grid grid-cols-2 items-end gap-4">
              <Field label="Grading">
                <Input
                  value={form.gradingCompany}
                  onChange={(e) => update("gradingCompany", e.target.value)}
                  placeholder="PSA, BGS, CGC…"
                />
              </Field>
              <Field label="Grade">
                <Input
                  value={form.grade}
                  onChange={(e) => update("grade", e.target.value)}
                  placeholder="10"
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
              <Button type="submit" disabled={submitting || !printing}>
                {submitting ? "Saving…" : `Add ${form.count}× to inventory`}
              </Button>
            </DialogFooter>
          </form>
        )}
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
    <div className="flex flex-col gap-1.5">
      <Label className="truncate whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
