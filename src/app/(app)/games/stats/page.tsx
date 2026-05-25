import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { BracketBadge } from "@/components/bracket-badge";
import { bracketRealityFlags } from "@/lib/games/queries";

export const dynamic = "force-dynamic";

type PerDeckOverall = {
  deck_id: string | null;
  deck_name: string;
  games: number;
  wins: number;
  losses: number;
};

type PerDeckBracket = {
  deck_id: string | null;
  deck_name: string;
  pod_bracket: number;
  games: number;
  wins: number;
};

export default async function GameStatsPage() {
  // One overall row per deck + a wider per-bracket pivot. Both share the
  // same name-snapshot fallback so deleted decks still appear with their
  // historical name.
  const overallRows = (await db.execute(sql`
    SELECT
      g.my_deck_id AS deck_id,
      COALESCE(d.name, g.my_deck_name_snapshot, '(unknown)') AS deck_name,
      COUNT(*)::int AS games,
      SUM(CASE WHEN g.won THEN 1 ELSE 0 END)::int AS wins,
      SUM(CASE WHEN g.won = false THEN 1 ELSE 0 END)::int AS losses
    FROM games g
    LEFT JOIN decks d ON d.id = g.my_deck_id
    WHERE g.won IS NOT NULL
    GROUP BY g.my_deck_id, COALESCE(d.name, g.my_deck_name_snapshot, '(unknown)')
    ORDER BY games DESC, wins DESC
  `)) as unknown as PerDeckOverall[];

  const bracketRows = (await db.execute(sql`
    SELECT
      g.my_deck_id AS deck_id,
      COALESCE(d.name, g.my_deck_name_snapshot, '(unknown)') AS deck_name,
      g.pod_bracket,
      COUNT(*)::int AS games,
      SUM(CASE WHEN g.won THEN 1 ELSE 0 END)::int AS wins
    FROM games g
    LEFT JOIN decks d ON d.id = g.my_deck_id
    WHERE g.won IS NOT NULL AND g.pod_bracket IS NOT NULL
    GROUP BY g.my_deck_id,
             COALESCE(d.name, g.my_deck_name_snapshot, '(unknown)'),
             g.pod_bracket
  `)) as unknown as PerDeckBracket[];

  const flags = await bracketRealityFlags();

  const bracketsByDeck = new Map<string, PerDeckBracket[]>();
  for (const r of bracketRows) {
    const key = r.deck_id ?? `__name:${r.deck_name}`;
    if (!bracketsByDeck.has(key)) bracketsByDeck.set(key, []);
    bracketsByDeck.get(key)!.push(r);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/games" label="Games" />
      </div>

      <header className="mb-6 border-b border-border-subtle pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Stats
        </p>
        <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-tight">
          Performance
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          What actually happens when you sit down with a deck. The
          bracket-reality check is the signal no static analysis can
          give you — your deck&rsquo;s record at its own bracket.
        </p>
      </header>

      {flags.length > 0 && (
        <Card className="mb-6 border-[var(--brand)]/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bracket-reality check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs text-text-muted">
              Decks whose actual record at their calculated bracket is
              lopsided (≥5 games, &lt;25% or &gt;75% win rate). Consider
              re-targeting.
            </p>
            <ul className="space-y-1.5">
              {flags.map((f) => (
                <li
                  key={`${f.deckId}-${f.podBracket}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/decks/${f.deckId}`}
                      className="font-medium hover:underline"
                    >
                      {f.deckName}
                    </Link>
                    <span className="ml-2 font-mono text-[11px] text-text-muted">
                      calc{" "}
                      <BracketBadge bracket={f.calculatedBracket} /> · pod{" "}
                      <BracketBadge bracket={f.podBracket} />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 text-xs">
                    <span className="num">
                      {f.wins}-{f.games - f.wins} ({f.winRatePct}%)
                    </span>
                    <span
                      className={
                        f.signal === "underperforming"
                          ? "rounded-sm bg-[var(--value-negative)]/15 px-1.5 py-px font-mono text-[10px] uppercase text-[var(--value-negative)]"
                          : "rounded-sm bg-[var(--value-positive)]/15 px-1.5 py-px font-mono text-[10px] uppercase text-[var(--value-positive)]"
                      }
                    >
                      {f.signal === "underperforming"
                        ? "plays below bracket"
                        : "underbracketed"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Per-deck record</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overallRows.length === 0 ? (
            <p className="empty-terminal px-6 py-12 text-center">
              no games logged yet
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-border-subtle bg-surface-inset/40 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Deck</th>
                  <th className="px-2 py-2 text-right">Games</th>
                  <th className="px-2 py-2 text-right">W-L</th>
                  <th className="px-2 py-2 text-right">Win %</th>
                  <th className="px-3 py-2 text-left">By bracket</th>
                </tr>
              </thead>
              <tbody>
                {overallRows.map((r) => {
                  const key = r.deck_id ?? `__name:${r.deck_name}`;
                  const buckets = bracketsByDeck.get(key) ?? [];
                  const pct =
                    r.games > 0
                      ? Math.round((r.wins / r.games) * 1000) / 10
                      : 0;
                  return (
                    <tr
                      key={key}
                      className="border-b border-border-subtle last:border-b-0 hover:bg-surface-inset/40"
                    >
                      <td className="px-3 py-2 font-medium">
                        {r.deck_id ? (
                          <Link
                            href={`/decks/${r.deck_id}`}
                            className="hover:underline"
                          >
                            {r.deck_name}
                          </Link>
                        ) : (
                          <span className="text-text-muted">{r.deck_name}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right num">{r.games}</td>
                      <td className="px-2 py-2 text-right num">
                        {r.wins}-{r.losses}
                      </td>
                      <td className="px-2 py-2 text-right num">{pct}%</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {buckets.length === 0 ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            buckets
                              .slice()
                              .sort((a, b) => a.pod_bracket - b.pod_bracket)
                              .map((b) => (
                                <span
                                  key={b.pod_bracket}
                                  className="inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface-raised px-1.5 py-0.5"
                                  title={`${b.wins}-${b.games - b.wins} at Bracket ${b.pod_bracket}`}
                                >
                                  <BracketBadge bracket={b.pod_bracket} />
                                  <span className="num">
                                    {b.wins}-{b.games - b.wins}
                                  </span>
                                </span>
                              ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
