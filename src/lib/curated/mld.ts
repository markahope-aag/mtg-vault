// Mass land denial — curated list per the WotC Commander Bracket guidance.
// See https://magic.wizards.com/en/news/announcements for the current rules.
// The bracket engine flags decks as needing Bracket 3+ when any of these
// appear in the 99. Update via PR review — additions affect every deck.
//
// Borderline entries are tagged inline. They get flagged the same way; the
// distinction exists only for future "soft warning" tuning.

export const MASS_LAND_DENIAL_NAMES: readonly string[] = [
  "Akroma's Vengeance",
  "Apocalypse",
  "Armageddon",
  "Boom // Bust",
  "Burning of Xinye",
  "Cataclysm",
  "Catastrophe",
  "Death Cloud",
  "Decree of Annihilation",
  "Devastation",
  "Global Ruin",
  "Impending Disaster",
  "Jokulhaups",
  "Magus of the Disk", // borderline
  "Obliterate",
  "Ravages of War",
  "Smokestack", // borderline
  "Stasis", // borderline
  "Static Orb", // borderline
  "Sunder",
  "Tergrid's Shadow",
  "Wildfire",
  "Winter Orb", // borderline (functional denial, not destruction)
  "Worldfire",
];

// Convenience Set for hot-path lookups during the Scryfall bulk sync.
export const MASS_LAND_DENIAL_SET: ReadonlySet<string> = new Set(
  MASS_LAND_DENIAL_NAMES,
);
