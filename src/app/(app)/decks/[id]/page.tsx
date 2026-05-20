import { notFound } from "next/navigation";
import { fetchDeckDetail } from "@/lib/decks/queries";
import { getAvailability } from "@/db/queries/availability";
import { DeckbuilderShell } from "@/components/deckbuilder/shell";

export const dynamic = "force-dynamic";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchDeckDetail(id);
  if (!detail) notFound();

  const oracleIds = Array.from(
    new Set([
      ...(detail.commander ? [detail.commander.oracleId] : []),
      ...(detail.partner ? [detail.partner.oracleId] : []),
      ...detail.cards.map((c) => c.card.oracleId),
    ]),
  );

  const availability = await getAvailability(oracleIds, id);

  return (
    <DeckbuilderShell
      initialDeck={detail}
      initialAvailability={availability}
    />
  );
}
