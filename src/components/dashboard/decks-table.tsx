import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BracketBadge } from "@/components/bracket-badge";

type DeckSummary = {
  id: string;
  name: string;
  commanderName: string | null;
  targetBracket: number | null;
  calculatedBracket: number | null;
  totalCards: number;
  totalValueUsd: number;
};

export function DecksTable({ deckSummaries }: { deckSummaries: DeckSummary[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Decks · {deckSummaries.length}
        </CardTitle>
        <Link
          href="/decks"
          className="font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
        >
          All →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {deckSummaries.length === 0 ? (
          <p className="empty-terminal px-5 py-6 text-center">
            no decks recorded
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-subtle bg-surface-inset/40 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
              <tr>
                <th className="px-3 py-1.5 text-left">Deck</th>
                <th className="px-2 py-1.5 text-left">Commander</th>
                <th className="px-2 py-1.5 text-center">Target</th>
                <th className="px-2 py-1.5 text-center">Calc</th>
                <th className="px-2 py-1.5 text-right">Cards</th>
                <th className="px-3 py-1.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {deckSummaries.map((d) => {
                const over =
                  d.targetBracket != null &&
                  d.calculatedBracket != null &&
                  d.calculatedBracket > d.targetBracket;
                return (
                  <tr
                    key={d.id}
                    className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-inset/40"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/decks/${d.id}`}
                        className="font-medium text-text-primary hover:underline"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-text-muted">
                      {d.commanderName ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <BracketBadge bracket={d.targetBracket} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="inline-flex items-center gap-1">
                        <BracketBadge bracket={d.calculatedBracket} />
                        {over && (
                          <span
                            className="size-1.5 rounded-full bg-[var(--color-bracket-3)]"
                            aria-label="Over target"
                          />
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="num text-text-primary">
                        {d.totalCards}
                        <span className="text-text-muted">/100</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="num text-text-primary">
                        ${d.totalValueUsd.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
