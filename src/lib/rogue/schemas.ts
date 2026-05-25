import { z } from "zod";

// Which slice of the user's collection the generator is allowed to lean on.
//  - unassigned: cards owned but not in any deck (safe default)
//  - all_owned: any card owned, even if committed to another deck — the
//      reconciler later flags conflicts
//  - ignore: treat inventory as zero; build against the full card pool
//      (acquire list)
export const INVENTORY_SCOPES = ["unassigned", "all_owned", "ignore"] as const;

export const PROPOSAL_KINDS = ["standard", "rogue"] as const;

export const generateProposalSchema = z.object({
  kind: z.enum(PROPOSAL_KINDS).default("standard"),
  commanderOracleId: z.string().uuid().optional(),
  archetypeBrief: z.string().trim().max(2000).optional(),
  targetBracket: z.number().int().min(1).max(5).nullable().optional(),
  inventoryScope: z.enum(INVENTORY_SCOPES).optional(),
});

export const saveProposalSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

// One entry in a proposal's cardList. Mirrors the ProposalCard type
// used by /api/proposals/[id]/save (which reads cardList and turns it
// into deck_cards). The PATCH endpoint previously accepted any array
// at all, which meant a malformed update could persist nonsense that
// later broke save() with a runtime cast.
export const proposalCardSchema = z.object({
  oracleId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  isLand: z.boolean().optional(),
  role: z.string().trim().max(60).optional(),
  rationale: z.string().trim().max(1000).optional(),
});

// PATCH body for /api/proposals/[id]. All fields optional — the
// route updates only what's present. targetBracket: number | null
// passes through (null lets the user clear a previously-set bracket).
export const patchProposalSchema = z
  .object({
    cardList: z.array(proposalCardSchema).max(200),
    archetypeBrief: z.string().trim().max(2000),
    targetBracket: z.number().int().min(1).max(5).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be present",
  });

export type ProposalCardInput = z.input<typeof proposalCardSchema>;
export type PatchProposalInput = z.input<typeof patchProposalSchema>;
export type GenerateProposalInput = z.input<typeof generateProposalSchema>;
export type SaveProposalInput = z.input<typeof saveProposalSchema>;
