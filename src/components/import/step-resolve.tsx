"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SourceLine, Thumb } from "./parts";
import type { PreviewResponse, Resolution, SourceRow } from "./types";

export function StepResolve({
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
                          className={`flex items-center gap-3 rounded border px-3 py-1.5 text-left text-sm ${
                            selected
                              ? "border-foreground bg-muted"
                              : "border-border hover:bg-muted/50"
                          }`}
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
                      className={`mt-1 inline-flex items-center gap-2 self-start rounded border px-3 py-1 text-xs ${
                        r?.kind === "skip"
                          ? "border-foreground bg-muted"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
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
