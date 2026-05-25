import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsedInDeck } from "@/lib/cards/queries";

export function UsedInDecksCard({ decks }: { decks: UsedInDeck[] }) {
  if (decks.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Used in decks ({decks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {decks.map((u) => (
            <li key={`${u.deckId}-${u.category}`}>
              <Link
                href={`/decks/${u.deckId}`}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.deckName}</p>
                  {u.commanderName && (
                    <p className="truncate text-xs text-muted-foreground">
                      {u.commanderName}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {u.category !== "main" && (
                    <Badge variant="outline" className="capitalize">
                      {u.category}
                    </Badge>
                  )}
                  <span className="tabular-nums text-muted-foreground">
                    ×{u.quantity}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
