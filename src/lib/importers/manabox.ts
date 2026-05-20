import {
  get,
  lower,
  normalizeCondition,
  normalizeLanguage,
  parseDate,
  parsePrice,
  type NormalizedRow,
} from "./types";

export function parseManabox(
  rows: Array<Record<string, string>>,
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  rows.forEach((raw, i) => {
    const name = get(raw, "Name");
    const setCode = get(raw, "Set code");
    const collectorNumber = get(raw, "Collector number");
    if (!name || !setCode || !collectorNumber) return;

    const foilRaw = lower(get(raw, "Foil"));
    const etched = foilRaw === "etched";
    const foil = foilRaw === "foil" || etched;

    // Prefer "List Count" if present, else "Quantity".
    const qtyRaw =
      get(raw, "List Count") ??
      get(raw, "Quantity") ??
      "1";
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
      acquiredPrice: parsePrice(get(raw, "Purchase price")),
      acquiredAt: parseDate(get(raw, "Date added", "Purchase date")),
      scryfallId: get(raw, "Scryfall ID"),
      _raw: raw,
    });
  });
  return out;
}
