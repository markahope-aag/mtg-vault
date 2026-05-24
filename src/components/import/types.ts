// Shared types for the import wizard. Lifted out of the page so each
// step component can import them without re-declaring.

export type ResolverPrinting = {
  id: string;
  oracleId: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  usd: string | null;
  usdFoil: string | null;
  imageUri: string | null;
  releasedAt: string | null;
  name: string;
};

export type SourceRow = {
  sourceRowIndex: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  foil: boolean;
  etched?: boolean;
  condition?: string;
  language?: string;
  acquiredPrice?: number;
  acquiredAt?: string;
  purchasedFrom?: string;
};

export type PreviewResponse = {
  format: string;
  fileHash: string;
  filename: string;
  totalRows: number;
  matched: Array<{
    row: SourceRow;
    printingId: string;
    printing: ResolverPrinting;
  }>;
  ambiguous: Array<{
    row: SourceRow;
    candidates: Array<{ printing: ResolverPrinting; score: number }>;
  }>;
  unmatched: Array<{ row: SourceRow; reason: string }>;
  duplicateOfPriorBatch: boolean;
  priorBatch?: {
    id: string;
    filename: string;
    createdAt: string;
    importedRows: number;
  } | null;
};

export type Resolution =
  | { kind: "selected"; printingId: string; printing: ResolverPrinting }
  | { kind: "skip" }
  | { kind: "pending" };

export type Step = 1 | 2 | 3 | 4 | 5;

export type SubmitResult = {
  batchId: string;
  importedRows: number;
  unmatchedRows: number;
  skippedRows: number;
};

export type ImportMode = "append" | "replace_location";

export const STEP_LABEL: Record<Step, string> = {
  1: "Upload",
  2: "Configure",
  3: "Resolve",
  4: "Confirm",
  5: "Done",
};
