import { CardImage } from "@/components/card-detail/card-image";
import { ManaCost } from "@/components/mana-cost";
import { pickCardImage } from "@/lib/card-image";

type CardForMeta = {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colorIdentity: string[] | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
};

type PrintingForMeta = {
  imageUris: unknown;
  cardFaces: unknown;
  setName: string;
  setCode: string;
  collectorNumber: string;
};

export function CardMetaPane({
  card,
  selectedPrinting,
}: {
  card: CardForMeta;
  selectedPrinting: PrintingForMeta | null | undefined;
}) {
  const ptOrLoyalty =
    card.loyalty != null
      ? `Loyalty ${card.loyalty}`
      : card.power != null && card.toughness != null
        ? `${card.power}/${card.toughness}`
        : null;

  return (
    <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
      <CardImage
        src={pickCardImage(
          selectedPrinting?.imageUris as
            | Record<string, string>
            | null
            | undefined,
          selectedPrinting?.cardFaces as
            | Array<{ image_uris?: Record<string, string> | null }>
            | null
            | undefined,
          "normal",
        )}
        alt={card.name}
      />

      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{card.name}</h1>
          {card.manaCost && (
            <div className="mt-1">
              <ManaCost cost={card.manaCost} size="sm" />
            </div>
          )}
        </div>

        <p className="text-sm font-medium text-foreground">{card.typeLine}</p>

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
            <span className="uppercase">{selectedPrinting.setCode}</span> · #
            {selectedPrinting.collectorNumber}
          </p>
        )}
      </div>
    </div>
  );
}
