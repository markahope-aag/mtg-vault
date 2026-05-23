export type DeckCard = {
  deckCardRow: {
    printingId: string;
    quantity: number;
    category: string;
  };
  card: {
    oracleId: string;
    name: string;
    manaCost: string | null;
    cmc: string | null;
    typeLine: string | null;
    oracleText: string | null;
    colors: string[] | null;
    colorIdentity: string[] | null;
    keywords: string[] | null;
  };
  printing: {
    id: string;
    setCode: string;
    setName: string;
    collectorNumber: string;
    imageUris: Record<string, string> | null;
    cardFaces: Array<{ image_uris?: Record<string, string> | null }> | null;
    usd: string | null;
    usdFoil: string | null;
  };
  ownership: {
    ownedCount: number;
    ownedAnyPrinting: number;
    availableCount: number;
  };
};

export type DeckCommander = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  cmc: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[] | null;
  colorIdentity: string[] | null;
  keywords: string[] | null;
  printing: {
    id: string;
    setCode: string;
    setName: string;
    collectorNumber: string;
    imageUris: Record<string, string> | null;
    cardFaces: Array<{ image_uris?: Record<string, string> | null }> | null;
    usd: string | null;
    usdFoil: string | null;
  };
};

export type DeckDetail = {
  deck: {
    id: string;
    name: string;
    commanderPrintingId: string | null;
    partnerPrintingId: string | null;
    targetBracket: number | null;
    archetype: string | null;
    notes: string | null;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
  };
  commander: DeckCommander | null;
  partner: DeckCommander | null;
  cards: DeckCard[];
  totalCards: number;
  totalValueUsd: number;
  colorIdentity: string[];
};

export function typeGroupOf(typeLine: string | null): string {
  if (!typeLine) return "Other";
  const t = typeLine;
  if (/\bCreature\b/.test(t)) return "Creatures";
  if (/\bPlaneswalker\b/.test(t)) return "Planeswalkers";
  if (/\bBattle\b/.test(t)) return "Battles";
  if (/\bSorcery\b/.test(t)) return "Sorceries";
  if (/\bInstant\b/.test(t)) return "Instants";
  if (/\bArtifact\b/.test(t)) return "Artifacts";
  if (/\bEnchantment\b/.test(t)) return "Enchantments";
  if (/\bLand\b/.test(t)) return "Lands";
  return "Other";
}

export const TYPE_GROUP_ORDER = [
  "Creatures",
  "Planeswalkers",
  "Battles",
  "Sorceries",
  "Instants",
  "Artifacts",
  "Enchantments",
  "Lands",
  "Other",
] as const;
