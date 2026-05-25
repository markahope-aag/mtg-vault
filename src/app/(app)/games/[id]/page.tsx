import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { BracketBadge } from "@/components/bracket-badge";
import { getGame } from "@/lib/games/queries";
import { DeleteGameButton } from "@/components/games/delete-button";

export const dynamic = "force-dynamic";

const WIN_TYPE_LABELS: Record<string, string> = {
  combo: "Combo",
  damage: "Damage",
  commander_damage: "Commander damage",
  alt_win: "Alternate win condition",
  mill: "Mill",
  poison: "Poison",
  concede: "Concession",
  other: "Other",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const g = await getGame(id);
  if (!g) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <BackLink href="/games" label="Games" />
        <DeleteGameButton gameId={g.id} />
      </div>

      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {g.won === true
              ? "Won"
              : g.won === false
                ? `Lost${g.myFinish && g.myFinish > 1 ? ` (${g.myFinish})` : ""}`
                : "Game"}
            <span className="font-mono text-text-muted"> · </span>
            <span className="text-text-secondary">
              {g.myDeckId ? (
                <Link
                  href={`/decks/${g.myDeckId}`}
                  className="hover:underline"
                >
                  {g.myDeckName ?? "—"}
                </Link>
              ) : (
                g.myDeckName ?? "—"
              )}
            </span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {new Date(g.playedAt).toLocaleString()}
            {g.podSize != null && ` · pod of ${g.podSize}`}
            {g.durationMinutes && ` · ${g.durationMinutes}m`}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          {g.podBracket != null && (
            <span className="inline-flex items-center gap-1">
              <span className="uppercase text-text-muted">Bracket</span>
              <BracketBadge bracket={g.podBracket} />
            </span>
          )}
          {g.winType && (
            <span className="rounded-sm bg-surface-inset px-2 py-0.5 text-[11px] uppercase">
              {WIN_TYPE_LABELS[g.winType] ?? g.winType}
            </span>
          )}
        </div>
      </header>

      {g.players.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pod</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {g.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.isMe ? "You" : p.playerName ?? "(unnamed)"}
                    </p>
                    {p.commanderName && (
                      <p className="font-mono text-[11px] text-text-muted">
                        {p.commanderOracleId ? (
                          <Link
                            href={`/cards/${p.commanderOracleId}`}
                            className="hover:underline"
                          >
                            {p.commanderName}
                          </Link>
                        ) : (
                          p.commanderName
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-text-muted">
                    {p.finish != null && (
                      <p className="num">finish #{p.finish}</p>
                    )}
                    {p.knockedOutBy && (
                      <p className="text-[10px]">KO by {p.knockedOutBy}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {g.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm">{g.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
