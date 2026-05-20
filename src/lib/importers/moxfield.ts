import {
  get,
  lower,
  normalizeCondition,
  normalizeLanguage,
  parseDate,
  parsePrice,
  type NormalizedRow,
} from "./types";

// Moxfield's "Edition" column carries the set code (e.g. "neo"), not the set
// name. "Edition Name" carries the friendly name on newer exports.
export function parseMoxfield(
  rows: Array<Record<string, string>>,
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  rows.forEach((raw, i) => {
    const name = get(raw, "Name");
    const setCode = get(raw, "Edition", "Edition Code", "Set code");
    const collectorNumber = get(raw, "Collector Number");
    if (!name || !setCode || !collectorNumber) return;

    const foilRaw = lower(get(raw, "Foil"));
    // Moxfield uses '1'/'0' but some exports emit 'foil'/'normal'.
    const foil = foilRaw === "1" || foilRaw === "foil" || foilRaw === "etched";
    const tags = lower(get(raw, "Tags") ?? "");
    const etched = foilRaw === "etched" || tags.includes("etched");

    const qtyRaw = get(raw, "Count", "Quantity") ?? "1";
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
      acquiredAt: parseDate(get(raw, "Last Modified")),
      _raw: raw,
    });
  });
  return out;
}
