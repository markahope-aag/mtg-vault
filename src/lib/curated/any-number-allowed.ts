// Cards whose own rules text says "A deck can have any number of cards named X."
// Verified against current Scryfall data, 2026. If a new one shows up, add it
// here — the deckbuilder's singleton-violation check reads from this set.

export const ANY_NUMBER_ALLOWED_NAMES: ReadonlySet<string> = new Set([
  "Rat Colony",
  "Persistent Petitioners",
  "Dragon's Approach",
  "Slime Against Humanity",
  "Hare Apparent",
  "Shadowborn Apostle",
  "Relentless Rats",
  "Templar Knight",
  "Nazgûl",
  "Seven Dwarves",
]);

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
