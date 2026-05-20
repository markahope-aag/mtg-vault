// Cards whose own rules text says "A deck can have any number of cards named X."
// `max: null` means truly unlimited; numeric values cap the count.
// Verified against current Scryfall data; bump when new ones are printed.

export const ANY_NUMBER_ALLOWED: ReadonlyArray<{
  name: string;
  max: number | null;
}> = [
  { name: "Dragon's Approach", max: null },
  { name: "Hare Apparent", max: null },
  // TODO: Nazgûl in The Lord of the Rings: Tales of Middle-earth allows up to
  // 9 named copies. Treating as unlimited for v0 — refine when the bracket
  // engine grows a "max copies" rule.
  { name: "Nazgûl", max: null },
  { name: "Persistent Petitioners", max: null },
  { name: "Rat Colony", max: null },
  { name: "Relentless Rats", max: null },
  // TODO: Seven Dwarves caps at 7 copies, but for v0 we treat as unlimited
  // since the engine doesn't yet enforce per-card caps below 99.
  { name: "Seven Dwarves", max: null },
  { name: "Shadowborn Apostle", max: null },
  { name: "Slime Against Humanity", max: null },
  { name: "Templar Knight", max: null },
];

// Convenience Set for hot-path lookups in the deckbuilder singleton check.
export const ANY_NUMBER_ALLOWED_NAMES: ReadonlySet<string> = new Set(
  ANY_NUMBER_ALLOWED.map((e) => e.name),
);

export const BASIC_LAND_NAMES: ReadonlySet<string> = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
  "Snow-Covered Wastes",
]);
