// Curated mass land denial list per spec §6.1.
// Cards whose primary effect is to destroy or otherwise neutralize multiple
// lands at once. Extend over time — flagging happens during the Scryfall
// bulk sync, so additions take effect on the next sync run.

export const MASS_LAND_DENIAL_NAMES: ReadonlySet<string> = new Set([
  "Armageddon",
  "Catastrophe",
  "Ravages of War",
  "Wildfire",
  "Decree of Annihilation",
  "Obliterate",
  "Jokulhaups",
  "Cataclysm",
  "Cleansing",
  "Worldfire",
  "Magus of the Disk",
  "Sunder",
  "Land Equilibrium",
  "Global Ruin",
  "Akroma's Vengeance",
]);
