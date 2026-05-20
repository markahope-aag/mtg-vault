export type InventoryRowWithCard = {
  id: string;
  printingId: string;
  foil: boolean;
  etched: boolean;
  condition: string;
  language: string;
  location: string | null;
  physicalId: string | null;
  acquiredPrice: string | null;
  acquiredAt: string | null;
  purchasedFrom: string | null;
  gradingCompany: string | null;
  grade: string | null;
  notes: string | null;
  disposedTo: string | null;
  disposedPrice: string | null;
  disposedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined from cards
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  colorIdentity: string[] | null;
  cmc: string | null;

  // Joined from printings
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  usdEtched: string | null;
  imageUri: string | null;
};

export type InventoryListResponse = {
  rows: InventoryRowWithCard[];
  nextCursor: string | null;
  totalCount: number;
  totalValueUsd: number;
};

export function currentValueOf(row: {
  foil: boolean;
  etched: boolean;
  usd: string | null;
  usdFoil: string | null;
  usdEtched: string | null;
}): number {
  const pick = row.etched
    ? row.usdEtched
    : row.foil
      ? row.usdFoil
      : row.usd;
  if (!pick) return 0;
  const n = Number.parseFloat(pick);
  return Number.isFinite(n) ? n : 0;
}
