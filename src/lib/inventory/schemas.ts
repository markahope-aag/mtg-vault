import { z } from "zod";

export const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export const CONDITION_LABELS: Record<(typeof CONDITIONS)[number], string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export const SORT_FIELDS = [
  "name",
  "cmc",
  "usd",
  "acquiredAt",
  "condition",
  "location",
  "createdAt",
] as const;

// Accepts a string, "", null, or undefined. Trims and normalizes to either
// a non-empty string (max 200 chars) or null. Previously rejected null,
// which broke any client that sent {location: null} for an empty optional.
const trimmed = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalDecimal = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseFloat(v);
    return Number.isFinite(n) ? n.toFixed(2) : null;
  });

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

export const createInventoryRowSchema = z.object({
  printingId: z.string().uuid(),
  foil: z.boolean().default(false),
  etched: z.boolean().default(false),
  condition: z.enum(CONDITIONS).default("NM"),
  language: z.string().min(2).max(8).default("en"),
  location: trimmed,
  physicalId: trimmed,
  acquiredPrice: optionalDecimal,
  acquiredAt: optionalDate,
  purchasedFrom: trimmed,
  gradingCompany: trimmed,
  grade: trimmed,
  notes: trimmed,
});

export type CreateInventoryRow = z.input<typeof createInventoryRowSchema>;

export const createInventoryBodySchema = z.object({
  rows: z.array(createInventoryRowSchema).min(1).max(500),
});

export const updateInventoryRowSchema = createInventoryRowSchema.partial();
export type UpdateInventoryRow = z.input<typeof updateInventoryRowSchema>;

export const disposeRowSchema = z.object({
  disposedTo: z.string().trim().min(1).max(200),
  disposedPrice: optionalDecimal,
  disposedAt: optionalDate,
  notes: trimmed,
});
export type DisposeRowInput = z.input<typeof disposeRowSchema>;
