import {
  get,
  lower,
  normalizeCondition,
  normalizeLanguage,
  parseDate,
  parsePrice,
  type NormalizedRow,
} from "./types";

export function parseArchidekt(
  rows: Array<Record<string, string>>,
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  rows.forEach((raw, i) => {
    const name = get(raw, "Name");
    const setCode = get(raw, "Edition Code", "Set Code");
    const collectorNumber = get(raw, "CollectorNumber", "Collector Number");
    if (!name || !setCode || !collectorNumber) return;

    const finish = lower(get(raw, "Finish"));
    const foil = finish === "foil" || finish === "etched";
    const etched = finish === "etched";

    const qtyRaw = get(raw, "Quantity") ?? "1";
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
      acquiredPrice: parsePrice(get(raw, "Purchase Price", "Price")),
      acquiredAt: parseDate(get(raw, "Date Added")),
      scryfallId: get(raw, "Scryfall Id", "Scryfall ID"),
      _raw: raw,
    });
  });
  return out;
}
