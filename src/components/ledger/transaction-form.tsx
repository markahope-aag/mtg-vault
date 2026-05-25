"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { AllocationPreview } from "./allocation-preview";
import { HeaderFields } from "./header-fields";
import { InColumn } from "./in-column";
import { KindSelector } from "./kind-selector";
import { OutColumn } from "./out-column";
import type { Channel, InLine, Kind, OutLine } from "./types";

// Transaction form orchestrator. Owns:
//   - Form state (kind, header fields, in/out line arrays)
//   - Submit handler (validation, confirm-toast for destructive kinds,
//     POST to /api/transactions, navigate to detail page on success)
//   - The live allocation preview computation
//
// Presentation is delegated to:
//   - kind-selector.tsx — purchase/sale/trade pill picker
//   - header-fields.tsx — counterparty, date, channel, cash legs, fees, notes
//   - out-column.tsx — inventory search + selected rows (sale + trade)
//   - in-column.tsx — card search + new-row editor (purchase + trade)
//   - allocation-preview.tsx — bottom summary band + submit button
//
// Shared UI types live in types.ts. API request shapes live in
// lib/ledger/schemas.ts.

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("purchase");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [counterparty, setCounterparty] = useState("");
  const [channel, setChannel] = useState<Channel>("lgs");
  const [cashOut, setCashOut] = useState("");
  const [cashIn, setCashIn] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");
  const [outRows, setOutRows] = useState<OutLine[]>([]);
  const [inRows, setInRows] = useState<InLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Show out side for sale + trade; in side for purchase + trade.
  // Cash legs: out side always available (purchase paid, trade gave cash);
  // in side available for sale + trade.
  const showOut = kind === "sale" || kind === "trade";
  const showIn = kind === "purchase" || kind === "trade";
  const showCashOut = kind !== "sale";
  const showCashIn = kind !== "purchase";

  // Live preview of what allocation will look like. Mirrors the server's
  // logic so the user can verify their cost-basis split before submit.
  const allocationPreview = useMemo(() => {
    const cashOutNum = Number.parseFloat(cashOut) || 0;
    const cashInNum = Number.parseFloat(cashIn) || 0;
    const inAllocated = inRows.map((r) => Number.parseFloat(r.value) || 0);
    const outAllocated = outRows.map((r) => Number.parseFloat(r.value) || 0);
    return {
      inTotal: inAllocated.reduce((s, v) => s + v, 0),
      outTotal: outAllocated.reduce((s, v) => s + v, 0),
      cashOutNum,
      cashInNum,
    };
  }, [inRows, outRows, cashOut, cashIn]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      if (kind === "purchase" && inRows.length === 0) {
        toast.error("A purchase needs at least one card going in.");
        return;
      }
      if (kind === "sale" && outRows.length === 0) {
        toast.error("A sale needs at least one card going out.");
        return;
      }
      if (kind === "trade" && (inRows.length === 0 || outRows.length === 0)) {
        toast.error("A trade needs at least one card on each side.");
        return;
      }

      // The actual submit — extracted so we can run it directly for a
      // pure purchase (no disposal risk) or behind a confirm for sales
      // and trades that will dispose physical inventory rows.
      const commit = async () => {
        setSubmitting(true);
        try {
          const lines = [
            ...outRows.map((r) => ({
              direction: "out" as const,
              printingId: r.printingId,
              inventoryId: r.id,
              allocatedValueOverride: r.value
                ? Number.parseFloat(r.value)
                : null,
            })),
            ...inRows.map((r) => ({
              direction: "in" as const,
              printingId: r.printingId,
              foil: r.foil,
              etched: r.etched,
              condition: r.condition,
              language: r.language,
              location: r.location || null,
              allocatedValueOverride: r.value
                ? Number.parseFloat(r.value)
                : null,
            })),
          ];
          const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind,
              occurredAt: new Date(occurredAt).toISOString(),
              counterparty: counterparty.trim() || null,
              channel,
              cashOutUsd: cashOut ? Number.parseFloat(cashOut) : null,
              cashInUsd: cashIn ? Number.parseFloat(cashIn) : null,
              feesUsd: fees ? Number.parseFloat(fees) : null,
              notes: notes.trim() || null,
              lines,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
          toast.success(`Logged ${kind}`);
          router.push(`/trades/${body.id}`);
          router.refresh();
        } catch (err) {
          toast.error(
            `Couldn't log: ${err instanceof Error ? err.message : String(err)}`,
          );
        } finally {
          setSubmitting(false);
        }
      };

      // Purchases don't dispose anything — submit straight through.
      if (outRows.length === 0) {
        await commit();
        return;
      }

      // Sales + trades dispose physical inventory rows. Confirm before
      // committing, since the dispose isn't a one-click undo (you'd
      // restore each row from the ledger detail page).
      const cardLabel = outRows.length === 1 ? "card" : "cards";
      const verb = kind === "sale" ? "sell" : "trade away";
      confirmToast(`Confirm ${kind}?`, {
        description: `This will mark ${outRows.length} physical ${cardLabel} disposed (${verb}d). You can restore individual rows from the transaction detail page if needed.`,
        confirmLabel: `Yes, ${verb}`,
        onConfirm: () => {
          void commit();
        },
      });
    },
    [
      kind,
      outRows,
      inRows,
      occurredAt,
      counterparty,
      channel,
      cashOut,
      cashIn,
      fees,
      notes,
      submitting,
      router,
    ],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <KindSelector kind={kind} onChange={setKind} />

      <HeaderFields
        kind={kind}
        counterparty={counterparty}
        onCounterpartyChange={setCounterparty}
        occurredAt={occurredAt}
        onOccurredAtChange={setOccurredAt}
        channel={channel}
        onChannelChange={setChannel}
        cashOut={cashOut}
        onCashOutChange={setCashOut}
        cashIn={cashIn}
        onCashInChange={setCashIn}
        fees={fees}
        onFeesChange={setFees}
        notes={notes}
        onNotesChange={setNotes}
        showCashOut={showCashOut}
        showCashIn={showCashIn}
      />

      <div
        className={`grid grid-cols-1 gap-6 ${kind === "trade" ? "lg:grid-cols-2" : ""}`}
      >
        {showOut && <OutColumn rows={outRows} setRows={setOutRows} />}
        {showIn && <InColumn rows={inRows} setRows={setInRows} />}
      </div>

      <AllocationPreview
        preview={allocationPreview}
        kind={kind}
        showOut={showOut}
        showIn={showIn}
        submitting={submitting}
      />
    </form>
  );
}
