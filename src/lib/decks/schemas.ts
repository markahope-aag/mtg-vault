import { z } from "zod";

const trimmed = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const archetype = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const createDeckSchema = z.object({
  name: z.string().trim().min(1).max(100),
  commanderPrintingId: z.string().uuid().nullable().optional(),
  partnerPrintingId: z.string().uuid().nullable().optional(),
  targetBracket: z.number().int().min(1).max(5).nullable().optional(),
  archetype,
  notes: trimmed,
  isPrimary: z.boolean().optional(),
});
export type CreateDeckInput = z.input<typeof createDeckSchema>;

export const updateDeckSchema = createDeckSchema.partial();

export const upsertDeckCardSchema = z
  .object({
    printingId: z.string().uuid(),
    category: z.string().trim().max(30).default("main"),
    delta: z.number().int().min(-99).max(99).optional(),
    set: z.number().int().min(0).max(99).optional(),
  })
  .refine((v) => v.delta != null || v.set != null, {
    message: "Provide either delta or set",
  });

export const DECK_ARCHETYPE_SUGGESTIONS = [
  "Aristocrats",
  "Voltron",
  "Stax",
  "Group Hug",
  "Combo",
  "Tokens",
  "Reanimator",
  "Spellslinger",
  "Lands",
  "Tribal",
  "Superfriends",
  "Counters",
] as const;
