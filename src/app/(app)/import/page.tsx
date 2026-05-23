"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageOff,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationSelect } from "@/components/location-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types matching the API response ──────────────────────────────

type ResolverPrinting = {
  id: string;
  oracleId: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  imageUri: string | null;
  releasedAt: string | null;
  name: string;
};

type SourceRow = {
  sourceRowIndex: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  foil: boolean;
  etched?: boolean;
  condition?: string;
  language?: string;
  acquiredPrice?: number;
  acquiredAt?: string;
  purchasedFrom?: string;
};

type PreviewResponse = {
  format: string;
  fileHash: string;
  filename: string;
  totalRows: number;
  matched: Array<{ row: SourceRow; printingId: string; printing: ResolverPrinting }>;
  ambiguous: Array<{ row: SourceRow; candidates: Array<{ printing: ResolverPrinting; score: number }> }>;
  unmatched: Array<{ row: SourceRow; reason: string }>;
  duplicateOfPriorBatch: boolean;
  priorBatch?: {
    id: string;
    filename: string;
    createdAt: string;
    importedRows: number;
  } | null;
};

type Resolution =
  | { kind: "selected"; printingId: string; printing: ResolverPrinting }
  | { kind: "skip" }
  | { kind: "pending" };

type Step = 1 | 2 | 3 | 4 | 5;

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [defaultLocation, setDefaultLocation] = useState("");
  const [purchasedFromDefault, setPurchasedFromDefault] = useState("");
  const [mode, setMode] = useState<"append" | "replace_location">("append");

  const [resolutions, setResolutions] = useState<Map<number, Resolution>>(
    new Map(),
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    batchId: string;
    importedRows: number;
    unmatchedRows: number;
    skippedRows: number;
  } | null>(null);


  // Initialize default resolutions when preview arrives: top candidate for
  // ambiguous, pending for unmatched.
  function initialResolutions(p: PreviewResponse): Map<number, Resolution> {
    const m = new Map<number, Resolution>();
    for (const a of p.ambiguous) {
      const top = a.candidates[0];
      m.set(
        a.row.sourceRowIndex,
        top
          ? { kind: "selected", printingId: top.printing.id, printing: top.printing }
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
      const data = await res.json();
      setSubmitResult(data);
      setStep(5);
      toast.success(`Imported ${data.importedRows} cards into ${defaultLocation}`);
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

const STEP_LABEL: Record<Step, string> = {
  1: "Upload",
  2: "Configure",
  3: "Resolve",
  4: "Confirm",
  5: "Done",
};

// ───────────────────────── Step 1 ─────────────────────────

function StepUpload({
  file,
  setFile,
  uploading,
  onUpload,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  uploading: boolean;
  onUpload: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload a CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center text-sm transition-colors ${
            dragging ? "border-foreground bg-muted" : "border-border"
          }`}
        >
          <Upload className="size-8 text-muted-foreground" />
          {file ? (
            <p className="font-medium">{file.name}</p>
          ) : (
            <>
              <p className="font-medium">Drop a CSV here or click to choose</p>
              <p className="text-xs text-muted-foreground">
                Supported: ManaBox, Moxfield, Archidekt, TCGPlayer
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Files are capped at 5MB / 25,000 rows. The CSV is parsed but nothing
          is written until you confirm.
        </p>
        <div className="flex justify-end">
          <Button disabled={!file || uploading} onClick={onUpload}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Parsing…
              </>
            ) : (
              <>
                Continue <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Step 2 ─────────────────────────

function StepConfigure({
  preview,
  defaultLocation,
  setDefaultLocation,
  purchasedFromDefault,
  setPurchasedFromDefault,
  mode,
  setMode,
  onBack,
  onNext,
}: {
  preview: PreviewResponse;
  defaultLocation: string;
  setDefaultLocation: (v: string) => void;
  purchasedFromDefault: string;
  setPurchasedFromDefault: (v: string) => void;
  mode: "append" | "replace_location";
  setMode: (v: "append" | "replace_location") => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Detected format:{" "}
            <Badge variant="secondary" className="ml-1 uppercase">
              {preview.format}
            </Badge>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {preview.filename}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <Stat label="Total rows" value={preview.totalRows} />
            <Stat
              label="Matched"
              value={preview.matched.length}
              tone="green"
            />
            <Stat
              label="Ambiguous"
              value={preview.ambiguous.length}
              tone="amber"
            />
            <Stat
              label="Unmatched"
              value={preview.unmatched.length}
              tone="red"
            />
          </div>
        </CardContent>
      </Card>

      {preview.duplicateOfPriorBatch && preview.priorBatch && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-amber-900">
              ⚠ Duplicate of a recent import
            </p>
            <p className="mt-1 text-amber-800/90">
              A file with this exact content was imported as batch{" "}
              <code className="rounded bg-amber-100 px-1 text-xs">
                {preview.priorBatch.id.slice(0, 8)}
              </code>{" "}
              ({preview.priorBatch.filename},{" "}
              {preview.priorBatch.importedRows} rows) on{" "}
              {new Date(preview.priorBatch.createdAt).toLocaleString()}. You
              can continue if this is intentional.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="defaultLocation">Default location (required)</Label>
            <LocationSelect
              value={defaultLocation}
              onChange={setDefaultLocation}
              placeholder="Pick a location"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchasedFromDefault">
              Default &ldquo;purchased from&rdquo; (optional)
            </Label>
            <Input
              id="purchasedFromDefault"
              value={purchasedFromDefault}
              onChange={(e) => setPurchasedFromDefault(e.target.value)}
              placeholder="Card Kingdom, TCGPlayer, …"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">
                  Append — add to existing inventory
                </SelectItem>
                <SelectItem value="replace_location">
                  Replace at location — dispose existing rows there first
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button disabled={!defaultLocation.trim()} onClick={onNext}>
          Next: review unmatched <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Step 3 ─────────────────────────

function StepResolve({
  preview,
  resolutions,
  setResolution,
  onBack,
  onNext,
}: {
  preview: PreviewResponse;
  resolutions: Map<number, Resolution>;
  setResolution: (idx: number, r: Resolution) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function skipAllUnmatched() {
    for (const u of preview.unmatched) {
      setResolution(u.row.sourceRowIndex, { kind: "skip" });
    }
  }
  function acceptAllAmbiguousTop() {
    for (const a of preview.ambiguous) {
      const top = a.candidates[0];
      if (top)
        setResolution(a.row.sourceRowIndex, {
          kind: "selected",
          printingId: top.printing.id,
          printing: top.printing,
        });
    }
  }

  // Block "Next" if any unmatched row is still pending.
  const anyPending = preview.unmatched.some(
    (u) => resolutions.get(u.row.sourceRowIndex)?.kind === "pending",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {preview.ambiguous.length > 0 && (
          <Button size="sm" variant="outline" onClick={acceptAllAmbiguousTop}>
            Accept top candidate for all ambiguous
          </Button>
        )}
        {preview.unmatched.length > 0 && (
          <Button size="sm" variant="outline" onClick={skipAllUnmatched}>
            Skip all unmatched
          </Button>
        )}
      </div>

      {preview.ambiguous.length === 0 && preview.unmatched.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nothing to resolve — every row matched cleanly. Move on.
          </CardContent>
        </Card>
      )}

      {preview.ambiguous.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Ambiguous ({preview.ambiguous.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.ambiguous.map((a) => {
              const r = resolutions.get(a.row.sourceRowIndex);
              return (
                <div key={a.row.sourceRowIndex} className="space-y-2">
                  <SourceLine row={a.row} />
                  <div className="grid gap-1">
                    {a.candidates.slice(0, 8).map((c) => {
                      const selected =
                        r?.kind === "selected" &&
                        r.printingId === c.printing.id;
                      return (
                        <button
                          key={c.printing.id}
                          type="button"
                          onClick={() =>
                            setResolution(a.row.sourceRowIndex, {
                              kind: "selected",
                              printingId: c.printing.id,
                              printing: c.printing,
                            })
                          }
                          className={`flex items-center gap-3 rounded border px-3 py-1.5 text-left text-sm ${selected ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"}`}
                        >
                          <input
                            type="radio"
                            checked={selected}
                            readOnly
                            tabIndex={-1}
                          />
                          <Thumb src={c.printing.imageUri} />
                          <div className="min-w-0 flex-1 truncate">
                            <span className="font-medium">
                              {c.printing.setName}
                            </span>{" "}
                            <span className="text-xs uppercase text-muted-foreground">
                              {c.printing.setCode}
                            </span>{" "}
                            <span className="text-xs text-muted-foreground">
                              #{c.printing.collectorNumber}
                            </span>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {c.printing.usd ? `$${c.printing.usd}` : "—"}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setResolution(a.row.sourceRowIndex, { kind: "skip" })
                      }
                      className={`mt-1 inline-flex items-center gap-2 self-start rounded border px-3 py-1 text-xs ${r?.kind === "skip" ? "border-foreground bg-muted" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                    >
                      Skip this row
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {preview.unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Unmatched ({preview.unmatched.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.unmatched.map((u) => (
              <UnmatchedRow
                key={u.row.sourceRowIndex}
                row={u.row}
                reason={u.reason}
                resolution={resolutions.get(u.row.sourceRowIndex)}
                onResolve={(r) => setResolution(u.row.sourceRowIndex, r)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button disabled={anyPending} onClick={onNext}>
          Next: confirm <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SourceLine({ row }: { row: SourceRow }) {
  return (
    <p className="text-xs text-muted-foreground">
      Row {row.sourceRowIndex}:{" "}
      <span className="text-foreground">{row.name}</span> ·{" "}
      <span className="uppercase">{row.setCode}</span> ·{" "}
      #{row.collectorNumber} · qty {row.quantity}
      {row.foil && (
        <Badge variant="secondary" className="ml-1 text-[10px]">
          foil
        </Badge>
      )}
    </p>
  );
}

function UnmatchedRow({
  row,
  reason,
  resolution,
  onResolve,
}: {
  row: SourceRow;
  reason: string;
  resolution: Resolution | undefined;
  onResolve: (r: Resolution) => void;
}) {
  const [query, setQuery] = useState(row.name);
  const [results, setResults] = useState<
    Array<{
      oracleId: string;
      name: string;
      manaCost: string | null;
      typeLine: string | null;
      defaultPrintingId: string | null;
      imageUri: string | null;
    }>
  >([]);
  const [showSearch, setShowSearch] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=10`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <SourceLine row={row} />
        <span className="shrink-0 text-xs text-muted-foreground">{reason}</span>
      </div>

      {resolution?.kind === "selected" && (
        <div className="flex items-center gap-2 rounded border bg-muted/40 px-3 py-1.5 text-sm">
          <Thumb src={resolution.printing.imageUri} />
          <span className="font-medium">{resolution.printing.name}</span>
          <span className="text-xs uppercase text-muted-foreground">
            {resolution.printing.setCode}
          </span>
          <span className="text-xs text-muted-foreground">
            #{resolution.printing.collectorNumber}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onResolve({ kind: "pending" })}
            className="ml-auto"
          >
            Change
          </Button>
        </div>
      )}

      {(resolution?.kind === "pending" || !resolution) && !showSearch && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowSearch(true);
              runSearch(row.name);
            }}
          >
            <Search className="size-3.5" /> Search
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onResolve({ kind: "skip" })}
          >
            Skip
          </Button>
        </div>
      )}

      {showSearch && resolution?.kind !== "selected" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch(query);
                }
              }}
              placeholder="Search by name…"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => runSearch(query)}
            >
              Search
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onResolve({ kind: "skip" })}
            >
              Skip
            </Button>
          </div>
          {results.length > 0 && (
            <div className="grid gap-1">
              {results.slice(0, 8).map((r) => (
                <button
                  key={r.oracleId}
                  type="button"
                  onClick={() => {
                    if (!r.defaultPrintingId) return;
                    onResolve({
                      kind: "selected",
                      printingId: r.defaultPrintingId,
                      printing: {
                        id: r.defaultPrintingId,
                        oracleId: r.oracleId,
                        setCode: "",
                        setName: "",
                        collectorNumber: "",
                        rarity: null,
                        usd: null,
                        usdFoil: null,
                        imageUri: r.imageUri,
                        releasedAt: null,
                        name: r.name,
                      },
                    });
                  }}
                  className="flex items-center gap-3 rounded border px-3 py-1.5 text-left text-sm hover:bg-muted/50"
                >
                  <Thumb src={r.imageUri} />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.typeLine}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {resolution?.kind === "skip" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Will be skipped.</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onResolve({ kind: "pending" })}
          >
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Step 4 ─────────────────────────

function StepConfirm({
  preview,
  resolutions,
  defaultLocation,
  mode,
  submitting,
  onBack,
  onSubmit,
}: {
  preview: PreviewResponse;
  resolutions: Map<number, Resolution>;
  defaultLocation: string;
  mode: "append" | "replace_location";
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // Count physical cards to be inserted: sum of matched quantities + selected
  // ambiguous/unmatched.
  let physical = 0;
  let csvRows = 0;
  let skipped = 0;
  for (const m of preview.matched) {
    physical += m.row.quantity;
    csvRows++;
  }
  for (const a of preview.ambiguous) {
    const r = resolutions.get(a.row.sourceRowIndex);
    if (r?.kind === "selected") {
      physical += a.row.quantity;
      csvRows++;
    } else skipped++;
  }
  for (const u of preview.unmatched) {
    const r = resolutions.get(u.row.sourceRowIndex);
    if (r?.kind === "selected") {
      physical += u.row.quantity;
      csvRows++;
    } else skipped++;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confirm import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Importing <strong>{physical}</strong> physical card
          {physical === 1 ? "" : "s"} across <strong>{csvRows}</strong> CSV
          row{csvRows === 1 ? "" : "s"} into <strong>{defaultLocation}</strong>.{" "}
          <strong>{skipped}</strong> row{skipped === 1 ? "" : "s"} will be
          skipped.
        </p>
        {mode === "replace_location" && (
          <p className="text-sm text-amber-700">
            ⚠ Existing rows at <strong>{defaultLocation}</strong> will be
            disposed first (recoverable via &ldquo;Undo&rdquo; in import history).
          </p>
        )}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Check className="size-4" /> Import {physical}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Step 5 ─────────────────────────

function StepDone({
  result,
  defaultLocation,
  onAnother,
  onView,
}: {
  result: {
    batchId: string;
    importedRows: number;
    unmatchedRows: number;
    skippedRows: number;
  };
  defaultLocation: string;
  onAnother: () => void;
  onView: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Done</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-green-300 bg-green-50/50 p-3 text-sm">
          <p className="font-medium text-green-900">
            ✓ Imported {result.importedRows} cards into {defaultLocation}.
          </p>
          {(result.unmatchedRows > 0 || result.skippedRows > 0) && (
            <p className="mt-1 text-xs text-green-900/80">
              {result.unmatchedRows} unmatched · {result.skippedRows} skipped
            </p>
          )}
          <p className="mt-1 text-xs text-green-900/80">
            Batch ID:{" "}
            <code className="rounded bg-green-100 px-1">
              {result.batchId.slice(0, 8)}
            </code>
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onView}>View inventory</Button>
          <Button variant="outline" onClick={onAnother}>
            Import another file
          </Button>
          <Link
            href="/import/history"
            className="ml-auto inline-flex items-center self-center text-sm text-muted-foreground hover:text-foreground"
          >
            Import history →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Bits ─────────────────────────

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-rose-700"
          : "";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="flex size-8 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="size-3.5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="size-8 rounded object-cover"
      loading="lazy"
    />
  );
}
