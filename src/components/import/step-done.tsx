"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubmitResult } from "./types";

export function StepDone({
  result,
  defaultLocation,
  onAnother,
  onView,
}: {
  result: SubmitResult;
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
