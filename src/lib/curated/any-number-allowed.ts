// Cards whose own rules text says "A deck can have any number of cards named X."
// `max: null` means truly unlimited; numeric values cap the count.
// Verified against current Scryfall data; bump when new ones are printed.

export const ANY_NUMBER_ALLOWED: ReadonlyArray<{
  name: string;
  max: number | null;
}> = [
  { name: "Dragon's Approach", max: null },
  { name: "Hare Apparent", max: null },
  // Nazgûl's printed rules text reads "A deck can have up to nine cards
  // named Nazgûl." Cap at 9; anything beyond is a singleton violation.
  { name: "Nazgûl", max: 9 },
  { name: "Persistent Petitioners", max: null },
  { name: "Rat Colony", max: null },
  { name: "Relentless Rats", max: null },
  // Seven Dwarves caps at 7 — printed rules text says "A deck can have up
  // to seven cards named Seven Dwarves."
  { name: "Seven Dwarves", max: 7 },
  { name: "Shadowborn Apostle", max: null },
  { name: "Slime Against Humanity", max: null },
  { name: "Templar Knight", max: null },
];

// Convenience Set for hot-path lookups in the deckbuilder singleton check.
export const ANY_NUMBER_ALLOWED_NAMES: ReadonlySet<string> = new Set(
  ANY_NUMBER_ALLOWED.map((e) => e.name),
);

// Per-card caps for the small set of cards that allow more than 1 but less
// than infinity. Anything not in this map is either unlimited (when listed
// in ANY_NUMBER_ALLOWED with max: null) or capped at 1 by the singleton rule.
export const ANY_NUMBER_ALLOWED_CAPS: ReadonlyMap<string, number> = new Map(
  ANY_NUMBER_ALLOWED.filter((e) => e.max != null).map(
    (e) => [e.name, e.max as number],
  ),
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
