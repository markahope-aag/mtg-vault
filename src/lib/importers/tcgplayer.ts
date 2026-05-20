import {
  get,
  lower,
  normalizeCondition,
  normalizeLanguage,
  parsePrice,
  type NormalizedRow,
} from "./types";

// TCGplayer's app and direct download don't ship a set code, only the friendly
// name. We can't reliably resolve without one; the resolver will fall back to
// name+set-name searches in that case.
export function parseTcgplayer(
  rows: Array<Record<string, string>>,
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  rows.forEach((raw, i) => {
    const name = get(raw, "Product Name", "Name");
    const collectorNumber = get(raw, "Number", "Card Number");
    if (!name || !collectorNumber) return;

    const setCode =
      get(raw, "Set Code") ??
      // Fall back: the friendly set name lowercased + spaced is not a code.
      "";

    const printing = lower(get(raw, "Printing"));
    const foil = printing.includes("foil");
    const etched = printing.includes("etched");

    const qtyRaw = get(raw, "Quantity", "Add to Quantity") ?? "1";
    const qty = Number.parseInt(qtyRaw, 10);

    out.push({
      sourceRowIndex: i + 1,
      name: name.trim(),
      setCode: setCode.trim().toLowerCase(),
      collectorNumber: collectorNumber.trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      foil,
      etched,
      condition: normalizeCondition(get(raw, "Condition")),
      language: normalizeLanguage(get(raw, "Language")),
      acquiredPrice: parsePrice(get(raw, "Purchase Price")),
      _raw: raw,
    });
  });
  return out;
}
