export const SUPPORTED_FORMATS = [
  "manabox",
  "moxfield",
  "archidekt",
  "tcgplayer",
] as const;
export type ImportFormat = (typeof SUPPORTED_FORMATS)[number] | "unknown";

export type ImportCondition = "NM" | "LP" | "MP" | "HP" | "DMG";

export type NormalizedRow = {
  sourceRowIndex: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  foil: boolean;
  etched?: boolean;
  condition?: ImportCondition;
  language?: string;
  acquiredPrice?: number;
  acquiredAt?: Date;
  purchasedFrom?: string;
  scryfallId?: string;
  _raw: Record<string, string>;
};

export function normalizeCondition(raw: string | undefined): ImportCondition {
  if (!raw) return "NM";
  const s = raw.trim().toLowerCase().replace(/[_\s]+/g, "");
  if (s.startsWith("nm") || s.startsWith("nearmint") || s === "m" || s === "mint")
    return "NM";
  if (s.startsWith("lp") || s.startsWith("lightlyplayed") || s === "ep")
    return "LP";
  if (s.startsWith("mp") || s.startsWith("moderatelyplayed") || s.startsWith("played"))
    return "MP";
  if (s.startsWith("hp") || s.startsWith("heavilyplayed")) return "HP";
  if (s.startsWith("dmg") || s.startsWith("damaged") || s === "d") return "DMG";
  return "NM";
}

export function normalizeLanguage(raw: string | undefined): string {
  if (!raw) return "en";
  const s = raw.trim().toLowerCase();
  // Common variants → ISO 639-1
  const map: Record<string, string> = {
    english: "en",
    en: "en",
    japanese: "ja",
    ja: "ja",
    jp: "ja",
    german: "de",
    de: "de",
    french: "fr",
    fr: "fr",
    spanish: "es",
    es: "es",
    italian: "it",
    it: "it",
    portuguese: "pt",
    pt: "pt",
    russian: "ru",
    ru: "ru",
    korean: "ko",
    ko: "ko",
    chinese: "zh",
    zh: "zh",
    zhs: "zh",
    zht: "zh",
  };
  return map[s] ?? (s.length === 2 ? s : "en");
}

export function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function lower(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

export function get(
  raw: Record<string, string>,
  ...candidates: string[]
): string | undefined {
  for (const c of candidates) {
    const v = raw[c];
    if (v != null && v !== "") return v;
    // case-insensitive header lookup fallback
    const key = Object.keys(raw).find(
      (k) => k.trim().toLowerCase() === c.trim().toLowerCase(),
    );
    if (key && raw[key]) return raw[key];
  }
  return undefined;
}
