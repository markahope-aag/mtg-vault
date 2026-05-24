import { z } from "zod";

// ─── Want list ───────────────────────────────────────────────────

export const createWantSchema = z.object({
  oracleId: z.string().uuid(),
  targetQuantity: z.number().int().min(1).max(99).default(1),
  maxPriceUsd: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const deleteWantSchema = z.object({ id: z.string().uuid() });

export type CreateWantInput = z.input<typeof createWantSchema>;

// ─── Scraper sources (admin) ─────────────────────────────────────

// Parser templates are the strategies a scraper source uses to pull
// listings from its target. Currently Shopify-only; new templates
// (e.g. WooCommerce JSON-LD, custom HTML parsers) add entries here.
export const PARSER_TEMPLATES = ["shopify"] as const;

export const createMarketSourceSchema = z.object({
  sourceKey: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "lowercase letters/digits/_- only"),
  displayName: z.string().trim().min(1).max(120),
  baseUrl: z.string().url(),
  parserTemplate: z.enum(PARSER_TEMPLATES),
  enabled: z.boolean().default(false),
  robotsAcknowledged: z.boolean().default(false),
  termsNotes: z.string().trim().max(2000).optional().nullable(),
  rateLimitPerMinute: z.number().int().min(1).max(60).default(5),
  rateLimitPerDay: z.number().int().min(1).max(10000).default(200),
  useWebUnlocker: z.boolean().default(false),
});

export const updateMarketSourceSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  robotsAcknowledged: z.boolean().optional(),
  termsNotes: z.string().trim().max(2000).optional().nullable(),
  rateLimitPerMinute: z.number().int().min(1).max(60).optional(),
  rateLimitPerDay: z.number().int().min(1).max(10000).optional(),
  useWebUnlocker: z.boolean().optional(),
});

export type CreateMarketSourceInput = z.input<typeof createMarketSourceSchema>;
export type UpdateMarketSourceInput = z.input<typeof updateMarketSourceSchema>;
