import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { cards, printings } from "@/db/schema";

type UsedInDeck = {
  deckId: string;
  deckName: string;
  commanderName: string | null;
  category: string;
  quantity: number;
};

async function fetchDecksUsing(oracleId: string): Promise<UsedInDeck[]> {
  const rows = (await db.execute(sql`
    SELECT d.id AS deck_id, d.name AS deck_name,
           cmd.name AS commander_name,
           dc.category, dc.quantity
    FROM deck_cards dc
    JOIN printings p ON p.id = dc.printing_id
    JOIN decks d ON d.id = dc.deck_id
    LEFT JOIN printings cmd_p ON cmd_p.id = d.commander_printing_id
    LEFT JOIN cards cmd ON cmd.oracle_id = cmd_p.oracle_id
    WHERE p.oracle_id = ${oracleId}
    ORDER BY d.name ASC
  `)) as unknown as Array<{
    deck_id: string;
    deck_name: string;
    commander_name: string | null;
    category: string;
    quantity: number;
  }>;
  return rows.map((r) => ({
    deckId: r.deck_id,
    deckName: r.deck_name,
    commanderName: r.commander_name,
    category: r.category,
    quantity: r.quantity,
  }));
}
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManaCost } from "@/components/mana-cost";
import { CardImage } from "@/components/card-detail/card-image";
import { OwnershipPanel } from "@/components/card-detail/ownership-panel";
import type { InventoryRowWithCard } from "@/lib/inventory/types";

type Printing = typeof printings.$inferSelect;

function pickPreferredImage(images: unknown): string | null {
  if (!images || typeof images !== "object") return null;
  const map = images as Record<string, string>;
  return map.normal ?? map.large ?? map.png ?? map.small ?? null;
}

function isPromoLike(p: Printing): boolean {
  return Array.isArray(p.promoTypes) && p.promoTypes.length > 0;
}

async function fetchOwnedRows(
  oracleId: string,
): Promise<InventoryRowWithCard[]> {
  const rows = (await db.execute(sql`
    SELECT
      i.id, i.printing_id, i.foil, i.etched, i.condition, i.language,
      i.location, i.physical_id, i.acquired_price, i.acquired_at,
      i.purchased_from, i.grading_company, i.grade, i.notes,
      i.disposed_to, i.disposed_price, i.disposed_at,
      i.created_at, i.updated_at,
      c.oracle_id, c.name, c.mana_cost, c.type_line, c.color_identity, c.cmc,
      p.set_code, p.set_name, p.collector_number, p.rarity,
      p.usd, p.usd_foil, p.usd_etched,
      (p.image_uris ->> 'small') AS image_uri
    FROM inventory i
    JOIN printings p ON p.id = i.printing_id
    JOIN cards c ON c.oracle_id = p.oracle_id
    WHERE c.oracle_id = ${oracleId}
      AND i.disposed_at IS NULL
    ORDER BY p.released_at DESC, i.created_at DESC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r.id as string,
    printingId: r.printing_id as string,
    foil: r.foil as boolean,
    etched: r.etched as boolean,
    condition: r.condition as string,
    language: r.language as string,
    location: (r.location as string | null) ?? null,
    physicalId: (r.physical_id as string | null) ?? null,
    acquiredPrice: (r.acquired_price as string | null) ?? null,
    acquiredAt: r.acquired_at
      ? (r.acquired_at as Date).toISOString()
      : null,
    purchasedFrom: (r.purchased_from as string | null) ?? null,
    gradingCompany: (r.grading_company as string | null) ?? null,
    grade: (r.grade as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    disposedTo: (r.disposed_to as string | null) ?? null,
    disposedPrice: (r.disposed_price as string | null) ?? null,
    disposedAt: r.disposed_at
      ? (r.disposed_at as Date).toISOString()
      : null,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
    oracleId: r.oracle_id as string,
    name: r.name as string,
    manaCost: (r.mana_cost as string | null) ?? null,
    typeLine: (r.type_line as string | null) ?? null,
    colorIdentity: (r.color_identity as string[] | null) ?? null,
    cmc: (r.cmc as string | null) ?? null,
    setCode: r.set_code as string,
    setName: r.set_name as string,
    collectorNumber: r.collector_number as string,
    rarity: (r.rarity as string | null) ?? null,
    usd: (r.usd as string | null) ?? null,
    usdFoil: (r.usd_foil as string | null) ?? null,
    usdEtched: (r.usd_etched as string | null) ?? null,
    imageUri: (r.image_uri as string | null) ?? null,
  }));
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

  const defaultPrinting =
    allPrintings.find((p) => !isPromoLike(p)) ?? allPrintings[0];
  const selectedPrinting =
    allPrintings.find((p) => p.id === requestedPrintingId) ?? defaultPrinting;

  const ownedRows = await fetchOwnedRows(oracle_id);
  const usedInDecks = await fetchDecksUsing(oracle_id);

  const tags: Array<{ label: string; tone: string }> = [];
  if (card.isGameChanger)
    tags.push({ label: "Game Changer", tone: "bg-rose-100 text-rose-900" });
  if (card.isMassLandDenial)
    tags.push({
      label: "Mass Land Denial",
      tone: "bg-amber-100 text-amber-900",
    });
  if (card.isExtraTurn)
    tags.push({
      label: "Extra Turn",
      tone: "bg-purple-100 text-purple-900",
    });
  if (card.isTutor)
    tags.push({ label: "Tutor", tone: "bg-sky-100 text-sky-900" });
  if (card.isReservedList)
    tags.push({
      label: "Reserved List",
      tone: "bg-stone-200 text-stone-800",
    });

  const ptOrLoyalty =
    card.loyalty != null
      ? `Loyalty ${card.loyalty}`
      : card.power != null && card.toughness != null
        ? `${card.power}/${card.toughness}`
        : null;

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
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        {/* LEFT: image + static metadata */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <CardImage
            src={pickPreferredImage(selectedPrinting?.imageUris)}
            alt={card.name}
          />

          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {card.name}
              </h1>
              {card.manaCost && (
                <div className="mt-1">
                  <ManaCost cost={card.manaCost} size="sm" />
                </div>
              )}
            </div>

            <p className="text-sm font-medium text-foreground">
              {card.typeLine}
            </p>

            {card.oracleText && (
              <div className="space-y-1.5 text-sm leading-relaxed text-foreground/90">
                {card.oracleText.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            {ptOrLoyalty && (
              <p className="text-sm font-semibold">{ptOrLoyalty}</p>
            )}

            {card.colorIdentity && card.colorIdentity.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Color identity</span>
                <ManaCost
                  cost={card.colorIdentity.map((c) => `{${c}}`).join("")}
                  size="xs"
                />
              </div>
            )}

            {selectedPrinting && (
              <p className="text-xs text-muted-foreground">
                {selectedPrinting.setName} ·{" "}
                <span className="uppercase">{selectedPrinting.setCode}</span> ·
                #{selectedPrinting.collectorNumber}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT */}
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
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Set</th>
                      <th className="px-2 py-2 text-left font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Rarity
                      </th>
                      <th className="px-2 py-2 text-right font-medium">USD</th>
                      <th className="px-2 py-2 text-right font-medium">
                        USD foil
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Released
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPrintings.map((p) => {
                      const isSelected = p.id === selectedPrinting?.id;
                      return (
                        <tr
                          key={p.id}
                          className={
                            isSelected
                              ? "border-b bg-muted/60"
                              : "border-b hover:bg-muted/40"
                          }
                        >
                          <td className="px-4 py-1.5">
                            <Link
                              href={`/cards/${oracle_id}?printing=${p.id}`}
                              scroll={false}
                              replace
                              className="block"
                            >
                              <span className="font-medium">{p.setName}</span>{" "}
                              <span className="text-xs uppercase text-muted-foreground">
                                {p.setCode}
                              </span>
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {p.collectorNumber}
                          </td>
                          <td className="px-2 py-1.5">
                            {p.rarity && (
                              <Badge variant="outline" className="capitalize">
                                {p.rarity}
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {p.usd ? `$${p.usd}` : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                            {p.usdFoil ? `$${p.usdFoil}` : "—"}
                          </td>
                          <td className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                            {p.releasedAt
                              ? new Date(p.releasedAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t.label}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${t.tone}`}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {usedInDecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Used in decks ({usedInDecks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {usedInDecks.map((u) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
