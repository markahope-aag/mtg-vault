import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { decks } from "@/db/schema";
import { reconcile } from "@/lib/rogue/reconcile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadTargetIds(deckId: string): Promise<{
  ok: boolean;
  oracleIds: string[];
  deckName: string;
}> {
  const deckRows = await db
    .select({
      name: decks.name,
      commanderPrintingId: decks.commanderPrintingId,
      partnerPrintingId: decks.partnerPrintingId,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  const deck = deckRows[0];
  if (!deck) return { ok: false, oracleIds: [], deckName: "" };

  const cardRows = (await db.execute(sql`
    SELECT p.oracle_id, dc.quantity
    FROM deck_cards dc
    JOIN printings p ON p.id = dc.printing_id
    WHERE dc.deck_id = ${deckId}
  `)) as unknown as Array<{ oracle_id: string; quantity: number }>;

  const oracleIds: string[] = [];
  for (const r of cardRows) {
    for (let i = 0; i < r.quantity; i++) oracleIds.push(r.oracle_id);
  }
  if (deck.commanderPrintingId) {
    const [cmd] = (await db.execute(sql`
      SELECT oracle_id FROM printings WHERE id = ${deck.commanderPrintingId} LIMIT 1
    `)) as unknown as Array<{ oracle_id: string }>;
    if (cmd) oracleIds.push(cmd.oracle_id);
  }
  if (deck.partnerPrintingId) {
    const [partner] = (await db.execute(sql`
      SELECT oracle_id FROM printings WHERE id = ${deck.partnerPrintingId} LIMIT 1
    `)) as unknown as Array<{ oracle_id: string }>;
    if (partner) oracleIds.push(partner.oracle_id);
  }

  return { ok: true, oracleIds, deckName: deck.name };
}

const BUCKET_LABEL: Record<string, string> = {
  available_now: "Available now",
  movable: "Movable from other decks",
  contested: "Contested",
  must_buy: "Must buy",
};

const BUCKET_TONE: Record<string, string> = {
  available_now:
    "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10",
  movable: "border-amber-500/40 bg-amber-500/10",
  contested: "border-[var(--color-bracket-3)]/40 bg-[var(--color-bracket-3)]/10",
  must_buy:
    "border-[var(--value-negative)]/40 bg-[var(--value-negative)]/10",
};

export default async function ReconcilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ok, oracleIds, deckName } = await loadTargetIds(id);
  if (!ok) notFound();

  const result = await reconcile({
    targetOracleIds: oracleIds,
    excludeDeckId: id,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href={`/decks/${id}`} label="Deckbuilder" />
      </div>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reconcile <span className="font-mono text-text-muted">·</span>{" "}
            {deckName}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            What this deck would cost to keep built, and what it contests with
            your other decks. Deterministic — no AI involved.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-wide">
          <span>
            <span className="text-text-muted">Available </span>
            <span className="tabular-nums text-[var(--value-positive)]">
              {result.summary.ownedUnassigned}
            </span>
          </span>
          <span>
            <span className="text-text-muted">Movable </span>
            <span className="tabular-nums text-amber-500">
              {result.summary.movableCount}
            </span>
          </span>
          <span>
            <span className="text-text-muted">Must buy </span>
            <span className="tabular-nums text-[var(--value-negative)]">
              {result.summary.mustBuyCount}
            </span>
          </span>
          <span>
            <span className="text-text-muted">Cheapest completion </span>
            <span className="font-semibold tabular-nums">
              ${result.summary.cheapestCompletionUsd.toFixed(2)}
            </span>
          </span>
        </div>
      </header>

      {result.preExistingContention.length > 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Pre-existing contention ({result.preExistingContention.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-text-secondary">
            <p className="mb-2">
              These cards are over-claimed by your existing decks even before
              this deck is counted. Not caused by this deck — just surfaced so
              the contested numbers below aren&rsquo;t blamed on it.
            </p>
            <ul className="space-y-1">
              {result.preExistingContention.map((c) => (
                <li key={c.oracleId}>
                  <Link
                    href={`/cards/${c.oracleId}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="ml-2 font-mono text-text-muted">
                    own {c.ownedCount}, claimed by {c.claimedByDecks} deck
                    {c.claimedByDecks === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Buckets */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["available_now", "movable", "contested", "must_buy"] as const).map(
          (k) => (
            <Card key={k} className={cn("border", BUCKET_TONE[k])}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {BUCKET_LABEL[k]}{" "}
                  <span className="ml-2 font-normal text-text-muted">
                    ({result.buckets[k].length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {result.buckets[k].length === 0 ? (
                  <p className="text-text-muted">—</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {result.buckets[k].map((c) => (
                      <li
                        key={c.oracleId}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <Link
                          href={`/cards/${c.oracleId}`}
                          className="min-w-0 truncate hover:underline"
                        >
                          {c.name}
                          {c.requested > 1 && (
                            <span className="ml-1 font-mono text-text-muted">
                              ×{c.requested}
                            </span>
                          )}
                        </Link>
                        <span className="shrink-0 font-mono tabular-nums text-text-muted">
                          {c.cheapestUsd != null
                            ? `$${c.cheapestUsd.toFixed(2)}`
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Scenarios */}
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        What-if scenarios
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.values(result.scenarios).map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="font-mono text-xs tabular-nums">
                  ${s.totalCostUsd.toFixed(2)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex flex-wrap gap-3 font-mono uppercase tracking-wide">
                <span>
                  <span className="text-text-muted">Buy </span>
                  <span className="tabular-nums">{s.shoppingList.length}</span>
                </span>
                {s.cardsPulledFromDecks.length > 0 && (
                  <span>
                    <span className="text-text-muted">Pull </span>
                    <span className="tabular-nums">
                      {s.cardsPulledFromDecks.length}
                    </span>
                  </span>
                )}
              </div>
              {s.decksImpacted.length > 0 && (
                <div className="space-y-0.5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Decks impacted
                  </p>
                  {s.decksImpacted.map((d) => (
                    <p key={d.deckId} className="text-xs">
                      {d.deckName}{" "}
                      <span className="font-mono text-text-muted">
                        −{d.cardsLost}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
