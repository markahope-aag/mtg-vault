import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { MASS_LAND_DENIAL_NAMES } from "@/lib/curated/mld";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

type CardSummary = {
  oracleId: string;
  name: string;
  typeLine: string | null;
  oracleText: string | null;
};

const AUDIT_LIMIT = 50;

export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  try {
    const [
      extraTurnSuspicious,
      extraTurnFalsePositive,
      mldMissingFromCurated,
      tutorMissing,
    ] = await Promise.all([
      execAudit(sql`
        SELECT oracle_id, name, type_line, oracle_text
        FROM cards
        WHERE oracle_text ILIKE '%extra turn%'
          AND is_extra_turn = false
          AND type_line NOT ILIKE '%Land%'
        ORDER BY name ASC
        LIMIT ${AUDIT_LIMIT}
      `),
      execAudit(sql`
        SELECT oracle_id, name, type_line, oracle_text
        FROM cards
        WHERE is_extra_turn = true
          AND (
            type_line ILIKE '%Land%'
            OR oracle_text NOT ILIKE '%take an extra turn%'
          )
        ORDER BY name ASC
        LIMIT ${AUDIT_LIMIT}
      `),
      execAudit(sql`
        SELECT oracle_id, name, type_line, oracle_text
        FROM cards
        WHERE (
          oracle_text ~* 'destroy all lands'
          OR oracle_text ~* 'each player sacrifices all lands'
        )
        AND NOT (name = ANY(${[...MASS_LAND_DENIAL_NAMES]}::text[]))
        ORDER BY name ASC
        LIMIT ${AUDIT_LIMIT}
      `),
      execAudit(sql`
        SELECT oracle_id, name, type_line, oracle_text
        FROM cards
        WHERE oracle_text ~* 'search your library for a (card|creature|enchantment|artifact|land|sorcery|instant|planeswalker)'
          AND is_tutor = false
        ORDER BY name ASC
        LIMIT ${AUDIT_LIMIT}
      `),
    ]);

    return NextResponse.json({
      extraTurnSuspicious,
      extraTurnFalsePositive,
      mldMissingFromCurated,
      tutorMissing,
    });
  } catch (err) {
    return serverError("api/admin/bracket-flag-audit", err, "Audit query failed.");
  }
}

async function execAudit(query: ReturnType<typeof sql>): Promise<CardSummary[]> {
  const rows = (await db.execute(query)) as unknown as Array<{
    oracle_id: string;
    name: string;
    type_line: string | null;
    oracle_text: string | null;
  }>;
  return rows.map((r) => ({
    oracleId: r.oracle_id,
    name: r.name,
    typeLine: r.type_line,
    oracleText: r.oracle_text,
  }));
}
