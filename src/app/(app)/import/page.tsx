"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepUpload } from "@/components/import/step-upload";
import { StepConfigure } from "@/components/import/step-configure";
import { StepResolve } from "@/components/import/step-resolve";
import { StepConfirm } from "@/components/import/step-confirm";
import { StepDone } from "@/components/import/step-done";
import {
  STEP_LABEL,
  type ImportMode,
  type PreviewResponse,
  type Resolution,
  type Step,
  type SubmitResult,
} from "@/components/import/types";

// Orchestrator for the 5-step CSV import wizard. Owns the wizard's
// state machine (step, file, preview, resolutions, submit result) and
// the two server calls (preview at /api/import/csv?commit=false, then
// commit at ?commit=true). Each step lives in its own file under
// src/components/import/.

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [defaultLocation, setDefaultLocation] = useState("");
  const [purchasedFromDefault, setPurchasedFromDefault] = useState("");
  const [mode, setMode] = useState<ImportMode>("append");

  const [resolutions, setResolutions] = useState<Map<number, Resolution>>(
    new Map(),
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // Initialize default resolutions when preview arrives: top candidate
  // for ambiguous, pending for unmatched.
  function initialResolutions(p: PreviewResponse): Map<number, Resolution> {
    const m = new Map<number, Resolution>();
    for (const a of p.ambiguous) {
      const top = a.candidates[0];
      m.set(
        a.row.sourceRowIndex,
        top
          ? {
              kind: "selected",
              printingId: top.printing.id,
              printing: top.printing,
            }
          : { kind: "pending" },
      );
    }
    for (const u of p.unmatched) {
      m.set(u.row.sourceRowIndex, { kind: "pending" });
    }
    return m;
  }

  const onUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/csv?commit=false", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      setResolutions(initialResolutions(data));
      setStep(2);
    } catch (err) {
      toast.error(
        `Failed to preview: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setUploading(false);
    }
  }, [file]);

  const setResolution = useCallback((idx: number, r: Resolution) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(idx, r);
      return next;
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const resolved: Array<{
        sourceRowIndex: number;
        printingId: string;
        quantity: number;
        foil: boolean;
        etched: boolean;
        condition: "NM" | "LP" | "MP" | "HP" | "DMG";
        language: string;
        acquiredPrice: number | null;
        acquiredAt: string | null;
        purchasedFrom: string | null;
      }> = [];

      // Matched rows go in as-is.
      for (const m of preview.matched) {
        resolved.push({
          sourceRowIndex: m.row.sourceRowIndex,
          printingId: m.printingId,
          quantity: m.row.quantity,
          foil: m.row.foil,
          etched: !!m.row.etched,
          condition: (m.row.condition ?? "NM") as
            | "NM"
            | "LP"
            | "MP"
            | "HP"
            | "DMG",
          language: m.row.language ?? "en",
          acquiredPrice: m.row.acquiredPrice ?? null,
          acquiredAt: m.row.acquiredAt ?? null,
          purchasedFrom: m.row.purchasedFrom ?? null,
        });
      }

      // Pull in user-resolved ambiguous + unmatched rows.
      const allOthers = [
        ...preview.ambiguous.map((a) => a.row),
        ...preview.unmatched.map((u) => u.row),
      ];
      let skippedCount = 0;
      for (const row of allOthers) {
        const r = resolutions.get(row.sourceRowIndex);
        if (!r || r.kind === "pending" || r.kind === "skip") {
          skippedCount++;
          continue;
        }
        resolved.push({
          sourceRowIndex: row.sourceRowIndex,
          printingId: r.printingId,
          quantity: row.quantity,
          foil: row.foil,
          etched: !!row.etched,
          condition: (row.condition ?? "NM") as
            | "NM"
            | "LP"
            | "MP"
            | "HP"
            | "DMG",
          language: row.language ?? "en",
          acquiredPrice: row.acquiredPrice ?? null,
          acquiredAt: row.acquiredAt ?? null,
          purchasedFrom: row.purchasedFrom ?? null,
        });
      }

      const res = await fetch("/api/import/csv?commit=true", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileHash: preview.fileHash,
          filename: preview.filename,
          format: preview.format,
          defaultLocation,
          purchasedFromDefault: purchasedFromDefault || undefined,
          mode,
          totalRows: preview.totalRows,
          resolved,
          unmatchedCount: preview.unmatched.length,
          skippedCount,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SubmitResult;
      setSubmitResult(data);
      setStep(5);
      toast.success(
        `Imported ${data.importedRows} cards into ${defaultLocation}`,
      );
    } catch (err) {
      toast.error(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }, [preview, resolutions, defaultLocation, purchasedFromDefault, mode]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="space-y-2">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Import
          </p>
          <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
            Import a CSV
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-wide text-[var(--text-muted)]">
              Step{" "}
              <span className="num text-[var(--text-primary)]">{step}</span> of{" "}
              <span className="num">5</span>
            </span>{" "}
            <span className="text-[var(--text-muted)]">·</span>{" "}
            {STEP_LABEL[step]}
          </p>
        </div>
        <Link
          href="/import/history"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          Import history →
        </Link>
      </header>

      {/* Header registers full-width with other pages; step body stays
       * narrow so the wizard form doesn't sprawl on wide displays. */}
      <div className="mx-auto w-full max-w-3xl">
        {step === 1 && (
          <StepUpload
            file={file}
            setFile={setFile}
            uploading={uploading}
            onUpload={onUpload}
          />
        )}

        {step === 2 && preview && (
          <StepConfigure
            preview={preview}
            defaultLocation={defaultLocation}
            setDefaultLocation={setDefaultLocation}
            purchasedFromDefault={purchasedFromDefault}
            setPurchasedFromDefault={setPurchasedFromDefault}
            mode={mode}
            setMode={setMode}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && preview && (
          <StepResolve
            preview={preview}
            resolutions={resolutions}
            setResolution={setResolution}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && preview && (
          <StepConfirm
            preview={preview}
            resolutions={resolutions}
            defaultLocation={defaultLocation}
            mode={mode}
            submitting={submitting}
            onBack={() => setStep(3)}
            onSubmit={onSubmit}
          />
        )}

        {step === 5 && submitResult && (
          <StepDone
            result={submitResult}
            defaultLocation={defaultLocation}
            onAnother={() => {
              setStep(1);
              setFile(null);
              setPreview(null);
              setResolutions(new Map());
              setSubmitResult(null);
              setDefaultLocation("");
              setPurchasedFromDefault("");
              setMode("append");
            }}
            onView={() => router.push("/inventory")}
          />
        )}
      </div>
    </div>
  );
}
