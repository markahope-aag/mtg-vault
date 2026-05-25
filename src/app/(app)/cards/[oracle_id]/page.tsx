import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { cards, printings } from "@/db/schema";
import { toIso } from "@/lib/utils";
import {
  fetchDecksUsing,
  fetchOwnedRows,
  fetchSynergies,
} from "@/lib/cards/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintingsTable } from "@/components/card-detail/printings-table";
import { BackLink } from "@/components/back-link";
import { OwnershipPanel } from "@/components/card-detail/ownership-panel";
import { PriceHistoryChart } from "@/components/card-detail/price-history-chart";
import { LegalityBadges } from "@/components/card-detail/legality-badges";
import { SynergyGrid } from "@/components/card-detail/synergy-grid";
import { CardMetaPane } from "@/components/card-detail/meta-pane";
import { TagsCard } from "@/components/card-detail/tags-card";
import { UsedInDecksCard } from "@/components/card-detail/used-in-decks-card";

type Printing = typeof printings.$inferSelect;

function isPromoLike(p: Printing): boolean {
  return Array.isArray(p.promoTypes) && p.promoTypes.length > 0;
}

type PageProps = {
  params: Promise<{ oracle_id: string }>;
  searchParams: Promise<{ printing?: string }>;
};

export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { oracle_id } = await params;
  const { printing: requestedPrintingId } = await searchParams;

  const cardRows = await db
    .select()
    .from(cards)
    .where(eq(cards.oracleId, oracle_id))
    .limit(1);
  const card = cardRows[0];
  if (!card) notFound();

  const allPrintings = await db
    .select()
    .from(printings)
    .where(eq(printings.oracleId, oracle_id))
    .orderBy(desc(printings.releasedAt), printings.setCode);

  const ownedRows = await fetchOwnedRows(oracle_id);
  const usedInDecks = await fetchDecksUsing(oracle_id);
  const synergies = await fetchSynergies(oracle_id);

  // Default to a printing the user actually owns (the newest, since
  // allPrintings is release-date descending) so the art matches their
  // copy. Fall back to the newest non-promo printing, then anything.
  const ownedPrintingIds = new Set(ownedRows.map((r) => r.printingId));
  const defaultPrinting =
    allPrintings.find((p) => ownedPrintingIds.has(p.id)) ??
    allPrintings.find((p) => !isPromoLike(p)) ??
    allPrintings[0];
  const selectedPrinting =
    allPrintings.find((p) => p.id === requestedPrintingId) ?? defaultPrinting;

  const dialogCard = {
    oracleId: card.oracleId,
    name: card.name,
    printings: allPrintings.map((p) => ({
      id: p.id,
      setCode: p.setCode,
      setName: p.setName,
      collectorNumber: p.collectorNumber,
      rarity: p.rarity,
      usd: p.usd,
      usdFoil: p.usdFoil,
      releasedAt: p.releasedAt ? p.releasedAt.toISOString() : null,
    })),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-4">
        <BackLink />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        <CardMetaPane card={card} selectedPrinting={selectedPrinting} />

        <div className="space-y-6">
          <OwnershipPanel card={dialogCard} ownedRows={ownedRows} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Printings{" "}
                <span className="font-normal text-muted-foreground">
                  ({allPrintings.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PrintingsTable
                oracleId={oracle_id}
                selectedId={selectedPrinting?.id}
                printings={allPrintings.map((p) => ({
                  id: p.id,
                  setCode: p.setCode,
                  setName: p.setName,
                  collectorNumber: p.collectorNumber,
                  rarity: p.rarity,
                  usd: p.usd,
                  usdFoil: p.usdFoil,
                  releasedAt: toIso(p.releasedAt),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price history (90d)</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistoryChart
                oracleId={oracle_id}
                printingId={selectedPrinting?.id}
              />
            </CardContent>
          </Card>

          <TagsCard
            flags={{
              isCommanderLegal: card.isCommanderLegal,
              isGameChanger: card.isGameChanger,
              isMassLandDenial: card.isMassLandDenial,
              isExtraTurn: card.isExtraTurn,
              isTutor: card.isTutor,
              isReservedList: card.isReservedList,
            }}
          />

          {card.legalities && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Format legality</CardTitle>
              </CardHeader>
              <CardContent>
                <LegalityBadges
                  legalities={card.legalities as Record<string, string>}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Synergies
                {synergies.length > 0 && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({synergies.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SynergyGrid entries={synergies} />
            </CardContent>
          </Card>

          <UsedInDecksCard decks={usedInDecks} />
        </div>
      </div>
    </div>
  );
}
