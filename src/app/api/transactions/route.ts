import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  inventory,
  transactionLines,
  transactions,
} from "@/db/schema";
import { allocateCost, type AllocationLine } from "@/lib/ledger/allocate";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// ─── Body shape ─────────────────────────────────────────────────

const lineSchema = z.object({
  direction: z.enum(["in", "out"]),
  printingId: z.string().uuid(),
  /** For 'out' lines: existing inventory row to dispose. For 'in' lines:
   *  leave null — a new inventory row will be created. */
  inventoryId: z.string().uuid().optional().nullable(),
  /** New-inventory metadata for 'in' lines. */
  foil: z.boolean().default(false),
  etched: z.boolean().default(false),
  condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).default("NM"),
  language: z.string().default("en"),
  location: z.string().trim().max(200).optional().nullable(),
  /** Manual per-line allocation override; otherwise auto-allocated. */
  allocatedValueOverride: z.number().nonnegative().optional().nullable(),
});

const bodySchema = z.object({
  kind: z.enum(["purchase", "sale", "trade"]),
  occurredAt: z.string().datetime(),
  counterparty: z.string().trim().max(200).optional().nullable(),
  channel: z
    .enum(["lgs", "online_marketplace", "private", "pack", "other"])
    .optional()
    .nullable(),
  cashOutUsd: z.number().nonnegative().optional().nullable(),
  cashInUsd: z.number().nonnegative().optional().nullable(),
  feesUsd: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(lineSchema).min(1).max(500),
});

// ─── POST ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Kind-shape sanity. A purchase needs >=1 in line; a sale needs >=1 out
  // line; a trade needs at least one of each. These aren't rules the
  // database enforces, so do it here to catch malformed UI submits.
  const ins = input.lines.filter((l) => l.direction === "in");
  const outs = input.lines.filter((l) => l.direction === "out");
  if (input.kind === "purchase" && ins.length === 0) {
    return NextResponse.json(
      { error: "A purchase needs at least one card going in." },
      { status: 400 },
    );
  }
  if (input.kind === "sale" && outs.length === 0) {
    return NextResponse.json(
      { error: "A sale needs at least one card going out." },
      { status: 400 },
    );
  }
  if (input.kind === "trade" && (ins.length === 0 || outs.length === 0)) {
    return NextResponse.json(
      { error: "A trade needs at least one card on each side." },
      { status: 400 },
    );
  }

  // 'out' lines must reference an existing inventory row to dispose.
  for (const line of outs) {
    if (!line.inventoryId) {
      return NextResponse.json(
        {
          error:
            "Every 'out' line must reference an existing inventory row via inventoryId.",
        },
        { status: 400 },
      );
    }
  }

  try {
    // Pull market value per printing in one shot (printings.usd at the
    // moment of recording — snapshot for allocation + retro fairness).
    const printingIds = [...new Set(input.lines.map((l) => l.printingId))];
    const priceRows = (await db.execute(sql`
      SELECT id, usd, usd_foil
      FROM printings
      WHERE id = ANY(ARRAY[${sql.join(
        printingIds.map((p) => sql`${p}::uuid`),
        sql`, `,
      )}])
    `)) as unknown as Array<{
      id: string;
      usd: string | null;
      usd_foil: string | null;
    }>;
    const priceByPrinting = new Map(priceRows.map((p) => [p.id, p]));

    // For 'out' lines we also need the existing inventory row's
    // acquired_price to compute realized P&L later; the transaction-detail
    // endpoint surfaces that on read, but we don't need it here.

    // Build the allocation input. Foil cards use usd_foil as the
    // market-value snapshot; non-foils use usd.
    const allocLines: AllocationLine[] = input.lines.map((l) => {
      const printingPrices = priceByPrinting.get(l.printingId);
      const market = l.foil
        ? Number.parseFloat(
            printingPrices?.usd_foil ?? printingPrices?.usd ?? "0",
          )
        : Number.parseFloat(printingPrices?.usd ?? "0");
      return {
        direction: l.direction,
        marketValueAtTime: Number.isFinite(market) ? market : 0,
        allocatedValueOverride: l.allocatedValueOverride ?? undefined,
      };
    });

    const allocated = allocateCost({
      kind: input.kind,
      cashOutUsd: input.cashOutUsd ?? 0,
      cashInUsd: input.cashInUsd ?? 0,
      lines: allocLines,
    });

    const occurredAt = new Date(input.occurredAt);
    const counterpartyLabel =
      input.kind === "trade" && input.counterparty
        ? `Trade: ${input.counterparty}`
        : (input.counterparty ?? null);

    const transactionId = await db.transaction(async (tx) => {
      const [txnRow] = await tx
        .insert(transactions)
        .values({
          kind: input.kind,
          occurredAt,
          counterparty: input.counterparty ?? null,
          channel: input.channel ?? null,
          cashOutUsd:
            input.cashOutUsd != null ? input.cashOutUsd.toFixed(2) : null,
          cashInUsd: input.cashInUsd != null ? input.cashInUsd.toFixed(2) : null,
          feesUsd: input.feesUsd != null ? input.feesUsd.toFixed(2) : null,
          notes: input.notes ?? null,
        })
        .returning({ id: transactions.id });

      // For each line: 'in' creates a new inventory row, 'out' updates the
      // existing one. Either way, set inventory.transaction_id + write the
      // canonical inventory.acquired_* / disposed_* fields from the
      // allocation result.
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const allocValue = allocated[i];
        const marketSnapshot =
          allocLines[i].marketValueAtTime > 0
            ? allocLines[i].marketValueAtTime
            : null;

        let inventoryId: string | null = null;
        if (line.direction === "in") {
          const [newRow] = await tx
            .insert(inventory)
            .values({
              printingId: line.printingId,
              foil: line.foil,
              etched: line.etched,
              condition: line.condition,
              language: line.language,
              location: line.location ?? null,
              acquiredPrice: allocValue.toFixed(2),
              acquiredAt: occurredAt,
              purchasedFrom: counterpartyLabel,
              transactionId: txnRow.id,
            })
            .returning({ id: inventory.id });
          inventoryId = newRow.id;
        } else {
          // 'out' — dispose the linked inventory row.
          await tx
            .update(inventory)
            .set({
              disposedAt: occurredAt,
              disposedTo: counterpartyLabel,
              disposedPrice: allocValue.toFixed(2),
              transactionId: txnRow.id,
              updatedAt: sql`now()`,
            })
            .where(eq(inventory.id, line.inventoryId!));
          inventoryId = line.inventoryId!;
        }

        await tx.insert(transactionLines).values({
          transactionId: txnRow.id,
          inventoryId,
          direction: line.direction,
          printingId: line.printingId,
          allocatedValueUsd: allocValue.toFixed(2),
          marketValueAtTimeUsd:
            marketSnapshot != null ? marketSnapshot.toFixed(2) : null,
        });
      }

      return txnRow.id;
    });

    return NextResponse.json({ id: transactionId }, { status: 201 });
  } catch (err) {
    return serverError(
      "api/transactions POST",
      err,
      "Couldn't record that transaction.",
    );
  }
}

// ─── GET (list) ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const kindFilter = req.nextUrl.searchParams.get("kind");
    const counterparty = req.nextUrl.searchParams.get("counterparty");
    const from = req.nextUrl.searchParams.get("from"); // ISO date
    const to = req.nextUrl.searchParams.get("to");

    const where: ReturnType<typeof sql>[] = [];
    if (kindFilter) where.push(sql`t.kind = ${kindFilter}`);
    if (counterparty)
      where.push(sql`t.counterparty ILIKE ${"%" + counterparty + "%"}`);
    if (from) where.push(sql`t.occurred_at >= ${from}::timestamp`);
    if (to) where.push(sql`t.occurred_at <= ${to}::timestamp`);
    const whereClause =
      where.length > 0
        ? sql`WHERE ${where.reduce((acc, cur, i) => (i === 0 ? cur : sql`${acc} AND ${cur}`))}`
        : sql``;

    const rows = (await db.execute(sql`
      SELECT
        t.id, t.kind, t.occurred_at, t.counterparty, t.channel,
        t.cash_out_usd, t.cash_in_usd, t.fees_usd, t.notes, t.created_at,
        COALESCE(s.in_count, 0)::int AS in_count,
        COALESCE(s.out_count, 0)::int AS out_count,
        COALESCE(s.in_value, 0)::numeric(12, 2) AS in_value,
        COALESCE(s.out_value, 0)::numeric(12, 2) AS out_value
      FROM transactions t
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE direction = 'in')::int AS in_count,
          COUNT(*) FILTER (WHERE direction = 'out')::int AS out_count,
          COALESCE(SUM(allocated_value_usd::numeric) FILTER (WHERE direction = 'in'), 0) AS in_value,
          COALESCE(SUM(allocated_value_usd::numeric) FILTER (WHERE direction = 'out'), 0) AS out_value
        FROM transaction_lines
        WHERE transaction_id = t.id
      ) s ON TRUE
      ${whereClause}
      ORDER BY t.occurred_at DESC, t.created_at DESC
      LIMIT 500
    `)) as unknown as Array<{
      id: string;
      kind: string;
      occurred_at: string;
      counterparty: string | null;
      channel: string | null;
      cash_out_usd: string | null;
      cash_in_usd: string | null;
      fees_usd: string | null;
      notes: string | null;
      created_at: string;
      in_count: number;
      out_count: number;
      in_value: string;
      out_value: string;
    }>;

    return NextResponse.json({
      transactions: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        occurredAt: new Date(r.occurred_at).toISOString(),
        counterparty: r.counterparty,
        channel: r.channel,
        cashOutUsd: r.cash_out_usd ? Number.parseFloat(r.cash_out_usd) : 0,
        cashInUsd: r.cash_in_usd ? Number.parseFloat(r.cash_in_usd) : 0,
        feesUsd: r.fees_usd ? Number.parseFloat(r.fees_usd) : 0,
        notes: r.notes,
        inCount: r.in_count,
        outCount: r.out_count,
        inValue: Number.parseFloat(r.in_value) || 0,
        outValue: Number.parseFloat(r.out_value) || 0,
      })),
    });
  } catch (err) {
    return serverError(
      "api/transactions GET",
      err,
      "Couldn't load transactions.",
    );
  }
}

// Silence lint on imports we don't use directly in this file.
void and;
void desc;
