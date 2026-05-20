import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManaCost } from "@/components/mana-cost";
import { DeckDetailActions } from "@/components/decks/deck-detail-actions";

export const dynamic = "force-dynamic";

const BRACKET_LABELS: Record<number, string> = {
  1: "B1 Exhibition",
  2: "B2 Core",
  3: "B3 Upgraded",
  4: "B4 Optimized",
  5: "B5 cEDH",
};

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchDeckDetail(id);
  if (!detail) notFound();

  const { deck, commander, partner, cards, totalCards, totalValueUsd, colorIdentity } = detail;

  const editable = {
    id: deck.id,
    name: deck.name,
    targetBracket: deck.targetBracket,
    archetype: deck.archetype,
    notes: deck.notes,
    isPrimary: deck.isPrimary,
    commander: commander
      ? {
          printingId: commander.printing.id,
          oracleId: commander.oracleId,
          name: commander.name,
          imageUri:
            (commander.printing.imageUris?.small as string | undefined) ??
            (commander.printing.imageUris?.normal as string | undefined) ??
            null,
          oracleText: commander.oracleText,
          colorIdentity: commander.colorIdentity,
          typeLine: commander.typeLine,
        }
      : null,
    partner: partner
      ? {
          printingId: partner.printing.id,
          oracleId: partner.oracleId,
          name: partner.name,
          imageUri:
            (partner.printing.imageUris?.small as string | undefined) ??
            (partner.printing.imageUris?.normal as string | undefined) ??
            null,
          oracleText: partner.oracleText,
          colorIdentity: partner.colorIdentity,
          typeLine: partner.typeLine,
        }
      : null,
  };

  const commanderImg =
    (commander?.printing.imageUris?.normal as string | undefined) ??
    (commander?.printing.imageUris?.large as string | undefined) ??
    null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link
        href="/decks"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← All decks
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {commanderImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={commanderImg}
              alt={commander?.name ?? deck.name}
              className="aspect-[488/680] w-full rounded-xl border object-cover shadow"
            />
          ) : (
            <div className="flex aspect-[488/680] w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground">
              <ImageOff className="size-12" />
            </div>
          )}
          <p className="text-center text-sm font-medium">
            {commander?.name ?? "No commander yet"}
          </p>
          {partner && (
            <p className="text-center text-xs text-muted-foreground">
              + {partner.name}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">{deck.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {deck.targetBracket && (
                  <Badge variant="secondary">
                    Target {BRACKET_LABELS[deck.targetBracket]}
                  </Badge>
                )}
                {deck.archetype && (
                  <Badge variant="outline">{deck.archetype}</Badge>
                )}
                {deck.isPrimary && <Badge>Primary</Badge>}
              </div>
            </div>
            <DeckDetailActions deck={editable} />
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <Stat label="Cards" value={`${totalCards} / 100`} />
            <Stat label="Value" value={`$${totalValueUsd.toFixed(2)}`} />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Color identity
              </p>
              {colorIdentity.length > 0 ? (
                <ManaCost
                  cost={colorIdentity.map((c) => `{${c}}`).join("")}
                  size="md"
                />
              ) : (
                <span className="text-sm text-muted-foreground">colorless</span>
              )}
            </div>
          </div>

          {deck.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                {deck.notes}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Deckbuilder UI coming in Phase 7
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                {cards.length === 0
                  ? "No deck_cards rows yet. POST /api/decks/[id]/cards { printingId, delta: 1 } to add a card slot."
                  : `${cards.length} card slots already present. The three-pane deckbuilder will render them in Phase 7.`}
              </p>
              <pre className="max-h-[400px] overflow-auto rounded bg-muted p-3 text-[11px] leading-snug">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
