import type { CONDITIONS } from "@/lib/inventory/schemas";

// UI-shape types for the transaction form. API request shapes live in
// src/lib/ledger/schemas.ts; these are the shapes the form's React
// state holds.

export type Kind = "purchase" | "sale" | "trade";
export type Channel =
  | "lgs"
  | "online_marketplace"
  | "private"
  | "pack"
  | "other";

export type InventoryRow = {
  id: string;
  name: string;
  setCode: string;
  foil: boolean;
  condition: string;
  imageUri: string | null;
  printingId: string;
  currentValue: number;
};

export type SearchResult = {
  oracleId: string;
  name: string;
  defaultPrintingId: string | null;
  imageUri: string | null;
  typeLine: string | null;
};

// An OutLine is an inventory row the user has picked to dispose, plus
// an editable allocated-value field (defaults to the row's current
// market value but can be overridden).
export type OutLine = InventoryRow & { value: string };

// An InLine is a not-yet-persisted incoming card. Becomes a new
// inventory row on commit.
export type InLine = {
  oracleId: string;
  printingId: string;
  name: string;
  setCode: string;
  imageUri: string | null;
  foil: boolean;
  etched: boolean;
  condition: (typeof CONDITIONS)[number];
  language: string;
  location: string;
  value: string;
};
