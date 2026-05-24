import Papa from "papaparse";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { importBatches, inventory } from "@/db/schema";
import { detectFormat } from "@/lib/importers/detect";
import { parseManabox } from "@/lib/importers/manabox";
import { parseMoxfield } from "@/lib/importers/moxfield";
import { parseArchidekt } from "@/lib/importers/archidekt";
import { parseTcgplayer } from "@/lib/importers/tcgplayer";
import { CONDITIONS } from "@/lib/inventory/schemas";
import { serverError } from "@/lib/api-errors";
import {
  resolvePrinting,
  type ResolverPrinting,
} from "@/lib/importers/resolver";
import type {
  ImportFormat,
  NormalizedRow,
} from "@/lib/importers/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 25_000;

function parse(format: ImportFormat, rows: Array<Record<string, string>>) {
  switch (format) {
    case "manabox":
      return parseManabox(rows);
    case "moxfield":
      return parseMoxfield(rows);
    case "archidekt":
      return parseArchidekt(rows);
    case "tcgplayer":
      return parseTcgplayer(rows);
    default:
      return [];
  }
}

// ───────────────────────── Preview (multipart) ─────────────────────────

async function handlePreview(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }

  const text = await file.text();
  const stripped = text.replace(/^﻿/, "");

  const parsed = Papa.parse<Record<string, string>>(stripped, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length > 0) {
    const firstFatal = parsed.errors.find((e) => e.type === "Quotes");
    if (firstFatal) {
      return NextResponse.json(
        { error: `CSV parse error: ${firstFatal.message}` },
        { status: 400 },
      );
    }
  }

  const headers = parsed.meta.fields ?? [];
  const format = detectFormat(headers);
  if (format === "unknown") {
    return NextResponse.json(
      {
        error:
          "Unrecognised CSV format. Supported: ManaBox, Moxfield, Archidekt, TCGPlayer.",
        headers,
      },
      { status: 422 },
    );
  }

  const dataRows = parsed.data.slice(0, MAX_ROWS);
  if (parsed.data.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `File too large for single import (${parsed.data.length} rows). Cap is ${MAX_ROWS}. Split into multiple uploads.`,
      },
      { status: 413 },
    );
  }

  const normalized = parse(format, dataRows);

  // Hash the original file content for dedupe.
  const fileHash = await sha256(stripped);

  const matched: Array<{
    row: NormalizedRow;
    printingId: string;
    printing: ResolverPrinting;
  }> = [];
  const ambiguous: Array<{
    row: NormalizedRow;
    candidates: Array<{ printing: ResolverPrinting; score: number }>;
  }> = [];
  const unmatched: Array<{ row: NormalizedRow; reason: string }> = [];

  for (const row of normalized) {
    const result = await resolvePrinting(row);
    if (result.status === "matched") {
      matched.push({
        row,
        printingId: result.printing.id,
        printing: result.printing,
      });
    } else if (result.status === "ambiguous") {
      ambiguous.push({ row, candidates: result.candidates });
    } else {
      unmatched.push({ row, reason: result.reason });
    }
  }

  // Check for prior batch with this same hash in the last 24h.
  const priorBatchRows = await db
    .select()
    .from(importBatches)
    .where(
      and(
        eq(importBatches.fileHash, fileHash),
        sql`created_at > now() - interval '24 hours'`,
      ),
    )
    .limit(1);

  return NextResponse.json({
    format,
    fileHash,
    filename: file.name,
    totalRows: normalized.length,
    matched,
    ambiguous,
    unmatched,
    duplicateOfPriorBatch: priorBatchRows.length > 0,
    priorBatch: priorBatchRows[0]
      ? {
          id: priorBatchRows[0].id,
          filename: priorBatchRows[0].filename,
          createdAt: priorBatchRows[0].createdAt.toISOString(),
          importedRows: priorBatchRows[0].importedRows,
        }
      : null,
  });
}

// ───────────────────────── Commit (JSON) ────────────────────────────────

const commitSchema = z.object({
  fileHash: z.string().min(1),
  filename: z.string().min(1),
  format: z.enum(["manabox", "moxfield", "archidekt", "tcgplayer"]),
  defaultLocation: z.string().trim().min(1).max(200),
  purchasedFromDefault: z.string().trim().max(200).optional(),
  mode: z.enum(["append", "replace_location"]),
  totalRows: z.number().int().min(0),
  resolved: z
    .array(
      z.object({
        sourceRowIndex: z.number().int(),
        printingId: z.string().uuid(),
        quantity: z.number().int().min(1).max(999),
        foil: z.boolean().default(false),
        etched: z.boolean().default(false),
        condition: z.enum(CONDITIONS).default("NM"),
        language: z.string().default("en"),
        acquiredPrice: z.number().optional().nullable(),
        acquiredAt: z.string().datetime().optional().nullable(),
        purchasedFrom: z.string().optional().nullable(),
      }),
    )
    .min(0)
    .max(MAX_ROWS),
  unmatchedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
});

async function handleCommit(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = commitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    fileHash,
    filename,
    format,
    defaultLocation,
    purchasedFromDefault,
    mode,
    totalRows,
    resolved,
    unmatchedCount,
    skippedCount,
  } = parsed.data;

  // Compute total physical cards being added (sum of quantities).
  const importedPhysicalRows = resolved.reduce((s, r) => s + r.quantity, 0);

  // Wrap the whole commit in a transaction. Without this, a mid-flight
  // failure on chunk N could leave the import_batches row + replace_location
  // disposes committed but only some inventory rows inserted — an
  // inconsistent state that's painful to clean up by hand.
  const batchId = await db.transaction(async (tx) => {
    // 1) Create the batch row first so we have an id for inventory linkage.
    const [batch] = await tx
      .insert(importBatches)
      .values({
        filename,
        fileHash,
        format,
        totalRows,
        importedRows: importedPhysicalRows,
        unmatchedRows: unmatchedCount,
        skippedRows: skippedCount,
        defaultLocation,
        mode,
      })
      .returning();

    // 2) In replace_location mode, dispose existing non-disposed rows at the
    //    target location, tagged with the batch id so undo can restore them.
    if (mode === "replace_location") {
      await tx
        .update(inventory)
        .set({
          disposedAt: sql`now()`,
          disposedTo: `replaced by import batch ${batch.id}`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(inventory.location, defaultLocation),
            isNull(inventory.disposedAt),
          ),
        );
    }

    // 3) Expand each resolved row into N inventory rows (one per physical
    //    card).
    const toInsert: (typeof inventory.$inferInsert)[] = [];
    for (const r of resolved) {
      for (let i = 0; i < r.quantity; i++) {
        toInsert.push({
          printingId: r.printingId,
          foil: r.foil,
          etched: r.etched,
          condition: r.condition,
          language: r.language,
          location: defaultLocation,
          acquiredPrice:
            r.acquiredPrice != null ? r.acquiredPrice.toFixed(2) : null,
          acquiredAt: r.acquiredAt ? new Date(r.acquiredAt) : null,
          purchasedFrom: r.purchasedFrom ?? purchasedFromDefault ?? null,
          importBatchId: batch.id,
        });
      }
    }

    // 4) Bulk insert in chunks (500/round-trip).
    for (let i = 0; i < toInsert.length; i += 500) {
      const slice = toInsert.slice(i, i + 500);
      if (slice.length > 0) await tx.insert(inventory).values(slice);
    }

    return batch.id;
  });

  return NextResponse.json({
    batchId,
    importedRows: importedPhysicalRows,
    unmatchedRows: unmatchedCount,
    skippedRows: skippedCount,
  });
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const commit = url.searchParams.get("commit") === "true";
  try {
    if (commit) return await handleCommit(req);
    return await handlePreview(req);
  } catch (err) {
    return serverError("api/import/csv", err, "Import failed. Please try again.");
  }
}
