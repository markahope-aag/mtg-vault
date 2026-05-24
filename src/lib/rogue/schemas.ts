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

export type GenerateProposalInput = z.input<typeof generateProposalSchema>;
export type SaveProposalInput = z.input<typeof saveProposalSchema>;
