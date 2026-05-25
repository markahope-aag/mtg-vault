import { z } from "zod";

export const WIN_TYPES = [
  "combo",
  "damage",
  "commander_damage",
  "alt_win",
  "mill",
  "poison",
  "concede",
  "other",
] as const;

export type WinType = (typeof WIN_TYPES)[number];

// Player row submitted with a new game. commanderOracleId is optional —
// the user can record "won vs unknown commander" and the data is still
// usable. The snapshot text is what they typed; we resolve to oracle id
// best-effort.
export const gamePlayerInputSchema = z.object({
  isMe: z.boolean().optional().default(false),
  playerName: z.string().trim().max(100).optional().nullable(),
  commanderOracleId: z.string().uuid().optional().nullable(),
  commanderNameSnapshot: z.string().trim().max(200).optional().nullable(),
  finish: z.number().int().min(1).max(8).optional().nullable(),
  knockedOutBy: z.string().trim().max(100).optional().nullable(),
});

// playedAt as ISO; coerce on the boundary. won + myFinish are both
// optional because some users only track wins, others track placement.
// If myFinish is 1, we backfill won = true server-side.
export const createGameSchema = z
  .object({
    playedAt: z.string().datetime().or(z.coerce.date().transform((d) => d.toISOString())),
    myDeckId: z.string().uuid().nullable().optional(),
    myDeckNameSnapshot: z.string().trim().max(200).optional().nullable(),
    podSize: z.number().int().min(2).max(8).optional().nullable(),
    myFinish: z.number().int().min(1).max(8).optional().nullable(),
    won: z.boolean().optional().nullable(),
    podBracket: z.number().int().min(1).max(5).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
    winType: z.enum(WIN_TYPES).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    players: z.array(gamePlayerInputSchema).max(8).optional().default([]),
  })
  .refine(
    (v) => v.myDeckId != null || (v.myDeckNameSnapshot?.trim().length ?? 0) > 0,
    {
      message: "Either myDeckId or myDeckNameSnapshot is required",
      path: ["myDeckId"],
    },
  );

// Patch: all fields optional, at least one required. Players are
// REPLACED wholesale when provided — easier to reason about than diff
// semantics for a 4-row child table.
export const patchGameSchema = z
  .object({
    playedAt: z.string().datetime().or(z.coerce.date().transform((d) => d.toISOString())),
    myDeckId: z.string().uuid().nullable(),
    myDeckNameSnapshot: z.string().trim().max(200).nullable(),
    podSize: z.number().int().min(2).max(8).nullable(),
    myFinish: z.number().int().min(1).max(8).nullable(),
    won: z.boolean().nullable(),
    podBracket: z.number().int().min(1).max(5).nullable(),
    durationMinutes: z.number().int().min(1).max(600).nullable(),
    winType: z.enum(WIN_TYPES).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    players: z.array(gamePlayerInputSchema).max(8),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be present",
  });

export const listGamesQuerySchema = z.object({
  deckId: z.string().uuid().optional(),
  podBracket: z.coerce.number().int().min(1).max(5).optional(),
  won: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
});

export type CreateGameInput = z.input<typeof createGameSchema>;
export type PatchGameInput = z.input<typeof patchGameSchema>;
export type GamePlayerInput = z.input<typeof gamePlayerInputSchema>;
