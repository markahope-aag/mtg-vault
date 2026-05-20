import type { ImportFormat } from "./types";

export function detectFormat(headers: string[]): ImportFormat {
  const h = new Set(headers.map((s) => s.trim().toLowerCase()));
  if (h.has("scryfall id") && h.has("foil")) return "manabox";
  if (h.has("tradelist count") && (h.has("edition") || h.has("edition name")))
    return "moxfield";
  if (
    (h.has("collectornumber") || h.has("collector number")) &&
    (h.has("edition code") || h.has("set code"))
  )
    return "archidekt";
  if (h.has("product name") && h.has("number")) return "tcgplayer";
  return "unknown";
}
