"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportMode, PreviewResponse, Resolution } from "./types";

export function StepConfirm({
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
  mode: ImportMode;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // Count physical cards to be inserted: sum of matched quantities +
  // selected ambiguous/unmatched.
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
          row{csvRows === 1 ? "" : "s"} into{" "}
          <strong>{defaultLocation}</strong>. <strong>{skipped}</strong> row
          {skipped === 1 ? "" : "s"} will be skipped.
        </p>
        {mode === "replace_location" && (
          <p className="text-sm text-amber-700">
            ⚠ Existing rows at <strong>{defaultLocation}</strong> will be
            disposed first (recoverable via &ldquo;Undo&rdquo; in import
            history).
          </p>
        )}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            onClick={() => {
              // replace_location mass-disposes whatever's currently at
              // the target location before inserting. Confirm before
              // running it — batch Undo recovers the import but only
              // until the batch is overwritten by another import.
              if (mode === "replace_location") {
                confirmToast(
                  `Replace contents of "${defaultLocation}"?`,
                  {
                    description: `Every active inventory row at "${defaultLocation}" will be marked disposed, then ${physical} new card${physical === 1 ? "" : "s"} will be imported. Recoverable from Import history → Undo.`,
                    confirmLabel: "Yes, replace",
                    onConfirm: onSubmit,
                  },
                );
              } else {
                onSubmit();
              }
            }}
            disabled={submitting}
          >
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
