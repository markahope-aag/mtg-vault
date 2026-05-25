import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type CommanderCheck =
  | { ok: true }
  | { ok: false; reason: string };

// Verify that the printing represents a card that can legally be a commander.
// For v0 we accept the textbook rule (Legendary Creature) plus the explicit
// "can be your commander" clause that appears on Planeswalkers and some
// special cards (Backgrounds use a different mechanic and are handled as
// partners, not commanders).
export async function validateCommanderPrinting(
  printingId: string,
): Promise<CommanderCheck> {
  const rows = (await db.execute(sql`
    SELECT c.type_line, c.oracle_text
    FROM printings p
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE p.id = ${printingId}
    LIMIT 1
  `)) as unknown as Array<{ type_line: string; oracle_text: string | null }>;
  if (rows.length === 0) {
    return { ok: false, reason: "printing not found" };
  }
  const r = rows[0];
  const isLegendaryCreature = /Legendary[^/\\]*Creature/i.test(r.type_line);
  const canBeCommander = /can be your commander/i.test(r.oracle_text ?? "");
  if (isLegendaryCreature || canBeCommander) return { ok: true };
  return {
    ok: false,
    reason: `${r.type_line} is not a legal commander`,
  };
}

export async function validatePartnerPrinting(
  commanderPrintingId: string,
  partnerPrintingId: string,
): Promise<CommanderCheck> {
  // Commander must advertise a supported multi-commander keyword (Partner,
  // Background, Friends Forever, or "Partner with …"). Background/Friends
  // Forever still accept any partner printing id — stricter partner-card
  // rules are deferred.
  const rows = (await db.execute(sql`
    SELECT c.oracle_text
    FROM printings p
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE p.id = ${commanderPrintingId}
    LIMIT 1
  `)) as unknown as Array<{ oracle_text: string | null }>;
  if (rows.length === 0) {
    return { ok: false, reason: "commander not found" };
  }
  const oracle = rows[0].oracle_text ?? "";
  const allowsPartner =
    /\bPartner\b/i.test(oracle) ||
    /Choose a Background/i.test(oracle) ||
    /Friends Forever/i.test(oracle) ||
    /Partner with/i.test(oracle);
  if (!allowsPartner) {
    return {
      ok: false,
      reason:
        "commander does not support a partner (needs Partner, Choose a Background, Friends Forever, or Partner with)",
    };
  }
  // We don't strictly validate the partner itself here — Phase 7 will be
  // stricter once we handle Backgrounds / Friends Forever explicitly.
  if (!partnerPrintingId) {
    return { ok: false, reason: "missing partner printing id" };
  }
  return { ok: true };
}
