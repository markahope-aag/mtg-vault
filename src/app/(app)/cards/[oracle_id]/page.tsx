import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { cards, printings } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManaCost } from "@/components/mana-cost";
import { CardImage } from "@/components/card-detail/card-image";

type Printing = typeof printings.$inferSelect;

type Ownership = {
  total: number;
  nonfoil: number;
  foil: number;
  etched: number;
};

function pickPreferredImage(images: unknown): string | null {
  if (!images || typeof images !== "object") return null;
  const map = images as Record<string, string>;
  return map.normal ?? map.large ?? map.png ?? map.small ?? null;
}

function isPromoLike(p: Printing): boolean {
  return Array.isArray(p.promoTypes) && p.promoTypes.length > 0;
}

async function fetchOwnership(oracleId: string): Promise<Ownership> {
  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(quantity), 0)::int AS total,
      COALESCE(SUM(CASE WHEN foil = false AND etched = false THEN quantity ELSE 0 END), 0)::int AS nonfoil,
      COALESCE(SUM(CASE WHEN foil = true THEN quantity ELSE 0 END), 0)::int AS foil,
      COALESCE(SUM(CASE WHEN etched = true THEN quantity ELSE 0 END), 0)::int AS etched
    FROM inventory
    WHERE printing_id IN (
      SELECT id FROM printings WHERE oracle_id = ${oracleId}
    )
  `)) as unknown as Array<Ownership>;
  return rows[0] ?? { total: 0, nonfoil: 0, foil: 0, etched: 0 };
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

  const ownership = await fetchOwnership(oracle_id);

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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        {/* LEFT: image (sticky) + static metadata */}
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

        {/* RIGHT: ownership, printings, tags */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">You own</CardTitle>
            </CardHeader>
            <CardContent>
              {ownership.total === 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Not in your inventory.
                  </p>
                  <Button size="sm" variant="outline" disabled>
                    Add to inventory
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <span>{ownership.total}</span>
                  </div>
                  {ownership.nonfoil > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Nonfoil</span>
                      <span>{ownership.nonfoil}</span>
                    </div>
                  )}
                  {ownership.foil > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Foil</span>
                      <span>{ownership.foil}</span>
                    </div>
                  )}
                  {ownership.etched > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Etched</span>
                      <span>{ownership.etched}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
        </div>
      </div>
    </div>
  );
}
