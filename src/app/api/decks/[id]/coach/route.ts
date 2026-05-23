import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { sqlArray } from "@/lib/sql";
import { serverError } from "@/lib/api-errors";
import {
  classifyCard,
  slotStatus,
  SLOT_ORDER,
  targetsForBracket,
  type Slot,
  type SlotStatus,
} from "@/lib/decks/slots";

export const dynamic = "force-dynamic";

const MAX_SUGGESTIONS_PER_SLOT = 20;

type SlotRow = {
  slot: Slot;
  count: number;
  target: { min: number; max: number; ideal: number };
  status: SlotStatus;
};

type SlotSuggestion = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  edhrecRank: number | null;
  availableCount: number;
};

type CoachResponse = {
  slots: SlotRow[];
  suggestions: Record<string, SlotSuggestion[]>;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const detail = await fetchDeckDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

  // 1) Classify what's already in the deck.
  const counts = new Map<Slot, number>();
  for (const c of detail.cards) {
    const slot = classifyCard({
      name: c.card.name,
      typeLine: c.card.typeLine,
      oracleText: c.card.oracleText,
      manaCost: c.card.manaCost,
    });
    counts.set(slot, (counts.get(slot) ?? 0) + c.deckCardRow.quantity);
  }
  if (detail.commander) {
    const slot = classifyCard(detail.commander);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  if (detail.partner) {
    const slot = classifyCard(detail.partner);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  const targets = targetsForBracket(detail.deck.targetBracket);
  const slots: SlotRow[] = SLOT_ORDER.map((slot) => {
    const target = targets[slot];
    const count = counts.get(slot) ?? 0;
    return { slot, count, target, status: slotStatus(count, target) };
  });

  // 2) Pull owned candidates for under-served slots only (cheap path) plus
  //    every slot the user might want to expand into. Filter: owned >0,
  //    color identity compatible, Commander-legal, not already in the deck.
  const inDeckOracleIds = new Set<string>(
    detail.cards.map((c) => c.card.oracleId),
  );
  if (detail.commander) inDeckOracleIds.add(detail.commander.oracleId);
  if (detail.partner) inDeckOracleIds.add(detail.partner.oracleId);

  const identity =
    detail.colorIdentity.length > 0
      ? detail.colorIdentity
      : ["W", "U", "B", "R", "G"];

  // Fetch a generous candidate pool — owned cards NOT committed to other
  // decks (one physical copy can only field one deck). We classify locally
  // and bucket by slot.
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id,
      c.name,
      c.mana_cost,
      c.type_line,
      c.oracle_text,
      c.edhrec_rank,
      (o.owned_count - COALESCE(other_decks.qty, 0))::int AS available_count
    FROM cards c
    INNER JOIN oracle_ownership o ON o.oracle_id = c.oracle_id
    LEFT JOIN (
      SELECT oracle_id, SUM(committed_qty)::int AS qty
      FROM deck_commitments
      WHERE deck_id <> ${id}::uuid
      GROUP BY oracle_id
    ) other_decks ON other_decks.oracle_id = c.oracle_id
    WHERE (o.owned_count - COALESCE(other_decks.qty, 0)) > 0
      AND c.is_commander_legal = TRUE
      AND COALESCE(c.color_identity, ARRAY[]::text[]) <@ ${sqlArray(identity, "text")}
    ORDER BY c.edhrec_rank ASC NULLS LAST
    LIMIT 800;
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    mana_cost: string | null;
    type_line: string | null;
    oracle_text: string | null;
    edhrec_rank: number | null;
    available_count: number;
  }>;

  const suggestions: Record<string, SlotSuggestion[]> = {};
  for (const slot of SLOT_ORDER) suggestions[slot] = [];

  for (const r of rows) {
    // In-deck cards drop out of the suggestions — except basic lands, which
    // are never "done": you can always add more, so keep them listed.
    const isBasic = /Basic Land/i.test(r.type_line ?? "");
    if (inDeckOracleIds.has(r.oracle_id) && !isBasic) continue;
    const slot = classifyCard({
      name: r.name,
      typeLine: r.type_line,
      oracleText: r.oracle_text,
      manaCost: r.mana_cost,
    });
    const bucket = suggestions[slot];
    if (bucket.length >= MAX_SUGGESTIONS_PER_SLOT) continue;
    bucket.push({
      oracleId: r.oracle_id,
      name: r.name,
      manaCost: r.mana_cost,
      typeLine: r.type_line,
      edhrecRank: r.edhrec_rank,
      availableCount: r.available_count,
    });
  }

    const response: CoachResponse = { slots, suggestions };
    return NextResponse.json(response);
  } catch (err) {
    return serverError(
      "api/decks/[id]/coach",
      err,
      "Coach analysis failed.",
    );
  }
}
