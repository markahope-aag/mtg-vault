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

// Rows fetched per inventory page (initial load + each "Load more").
export const INVENTORY_PAGE_SIZE = 200;

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
  // Prefer the finish-specific price, but fall back when it's missing — many
  // printings have a base `usd` with no recorded foil/etched price, and
  // showing $0.00 for a foil card that has a known base value is misleading.
  const candidates = row.etched
    ? [row.usdEtched, row.usdFoil, row.usd]
    : row.foil
      ? [row.usdFoil, row.usd]
      : [row.usd];
  for (const c of candidates) {
    if (!c) continue;
    const n = Number.parseFloat(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
