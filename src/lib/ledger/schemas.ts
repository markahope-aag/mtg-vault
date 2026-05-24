import { z } from "zod";
import { CONDITIONS } from "@/lib/inventory/schemas";

// Channels are the rough provenance categories surfaced in the
// transaction form. Free-text counterparty is separate; channel is the
// coarse grouping used for analytics / filtering.
export const CHANNELS = [
  "lgs",
  "online_marketplace",
  "private",
  "pack",
  "other",
] as const;

export const transactionLineSchema = z.object({
  direction: z.enum(["in", "out"]),
  printingId: z.string().uuid(),
  /** For 'out' lines: existing inventory row to dispose. For 'in' lines:
   *  leave null — a new inventory row will be created. */
  inventoryId: z.string().uuid().optional().nullable(),
  /** New-inventory metadata for 'in' lines. */
  foil: z.boolean().default(false),
  etched: z.boolean().default(false),
  condition: z.enum(CONDITIONS).default("NM"),
  language: z.string().default("en"),
  location: z.string().trim().max(200).optional().nullable(),
  /** Manual per-line allocation override; otherwise auto-allocated. */
  allocatedValueOverride: z.number().nonnegative().optional().nullable(),
});

export const createTransactionSchema = z.object({
  kind: z.enum(["purchase", "sale", "trade"]),
  occurredAt: z.string().datetime(),
  counterparty: z.string().trim().max(200).optional().nullable(),
  channel: z.enum(CHANNELS).optional().nullable(),
  cashOutUsd: z.number().nonnegative().optional().nullable(),
  cashInUsd: z.number().nonnegative().optional().nullable(),
  feesUsd: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(transactionLineSchema).min(1).max(500),
});

// Header-level edits only. Line edits aren't supported — that'd require
// reversing + reapplying the original inventory side-effects and is
// deferred until the workflow demands it.
export const updateTransactionSchema = z.object({
  counterparty: z.string().trim().max(200).optional().nullable(),
  channel: z.enum(CHANNELS).optional().nullable(),
  cashOutUsd: z.number().nonnegative().optional().nullable(),
  cashInUsd: z.number().nonnegative().optional().nullable(),
  feesUsd: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
});

export type TransactionLineInput = z.input<typeof transactionLineSchema>;
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
