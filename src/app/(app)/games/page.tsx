import Link from "next/link";
import { Plus, ChartLine } from "lucide-react";
import { listGames } from "@/lib/games/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BracketBadge } from "@/components/bracket-badge";

export const dynamic = "force-dynamic";

const WIN_TYPE_LABELS: Record<string, string> = {
  combo: "Combo",
  damage: "Damage",
  commander_damage: "Cmd dmg",
  alt_win: "Alt",
  mill: "Mill",
  poison: "Poison",
  concede: "Concede",
  other: "Other",
};

export default async function GamesPage() {
  const rows = await listGames({ limit: 200 });

  // Cheap top-line: total games + overall W-L on the page so the user
  // sees something useful even before clicking through to /games/stats.
  const totals = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.won === true) acc.wins += 1;
      else if (r.won === false) acc.losses += 1;
      return acc;
    },
    { total: 0, wins: 0, losses: 0 },
  );
  const winPct =
    totals.wins + totals.losses > 0
      ? Math.round((totals.wins / (totals.wins + totals.losses)) * 1000) / 10
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Games
          </p>
          <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-tight">
            Game log
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {totals.total} logged
            {winPct != null && (
              <>
                {" · "}
                <span className="num">
                  {totals.wins}-{totals.losses}
                </span>
                {" · "}
                <span className="num">{winPct}% win rate</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/games/stats">
            <Button variant="outline" size="sm">
              <ChartLine className="size-4" /> Stats
            </Button>
          </Link>
          <Link href="/games/new">
            <Button size="sm">
              <Plus className="size-4" /> Log game
            </Button>
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-text-muted">
            No games logged yet.{" "}
            <Link
              href="/games/new"
              className="text-text-primary underline-offset-2 hover:underline"
            >
              Log your first
            </Link>{" "}
            — it&rsquo;s 20 seconds and powers every stat in the app.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-subtle bg-surface-inset/40 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Deck</th>
                <th className="px-2 py-2 text-center">Bracket</th>
                <th className="px-2 py-2 text-center">Pod</th>
                <th className="px-2 py-2 text-center">Result</th>
                <th className="px-2 py-2 text-left">Win type</th>
                <th className="px-3 py-2 text-right">Dur.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-inset/40"
                >
                  <td className="px-3 py-1.5 font-mono text-[11px] text-text-muted">
                    <Link
                      href={`/games/${g.id}`}
                      className="text-text-primary hover:underline"
                    >
                      {new Date(g.playedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">
                    {g.myDeckId ? (
                      <Link
                        href={`/decks/${g.myDeckId}`}
                        className="text-text-primary hover:underline"
                      >
                        {g.myDeckName ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-text-muted">
                        {g.myDeckName ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <BracketBadge bracket={g.podBracket} />
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-[11px] text-text-muted">
                    {g.podSize ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {g.won === true ? (
                      <span className="inline-flex items-center rounded-sm bg-[var(--value-positive)]/15 px-1.5 py-px font-mono text-[10px] uppercase text-[var(--value-positive)]">
                        Won
                      </span>
                    ) : g.won === false ? (
                      <span className="inline-flex items-center rounded-sm bg-[var(--value-negative)]/15 px-1.5 py-px font-mono text-[10px] uppercase text-[var(--value-negative)]">
                        Lost{g.myFinish && g.myFinish > 1 ? ` (${g.myFinish})` : ""}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-text-muted">
                    {g.winType ? WIN_TYPE_LABELS[g.winType] ?? g.winType : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11px] text-text-muted">
                    {g.durationMinutes ? `${g.durationMinutes}m` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
