import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { importBatches } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UndoBatchButton } from "./undo-button";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const batches = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.createdAt))
    .limit(100);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="space-y-2">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Import · History
          </p>
          <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
            Import history
          </h1>
          <p className="max-w-prose text-[14px] text-[var(--text-secondary)]">
            Most recent imports first. Undo wipes the rows it created and
            restores any rows it disposed.
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          ← Back to import
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {batches.length} batch{batches.length === 1 ? "" : "es"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <p className="empty-terminal p-6 text-center">
              no imports recorded
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Filename</th>
                  <th className="px-2 py-2 text-left">Format</th>
                  <th className="px-2 py-2 text-left">Mode</th>
                  <th className="px-2 py-2 text-left">Location</th>
                  <th className="px-2 py-2 text-right">CSV rows</th>
                  <th className="px-2 py-2 text-right">Imported</th>
                  <th className="px-2 py-2 text-right">Unmatched</th>
                  <th className="px-2 py-2 text-right">Skipped</th>
                  <th className="px-2 py-2 text-left">Created</th>
                  <th className="w-32 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">{b.filename}</span>
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant="secondary" className="uppercase">
                        {b.format}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-xs">{b.mode}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {b.defaultLocation ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.totalRows}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {b.importedRows}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {b.unmatchedRows}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {b.skippedRows}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/inventory?filter[importBatchId]=${b.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          View
                        </Link>
                        <UndoBatchButton batchId={b.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
