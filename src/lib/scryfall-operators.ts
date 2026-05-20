// Scryfall search operators we recognize for routing decisions.
// If any of these show up in a search query, we proxy to Scryfall instead of
// running a local trigram match — the user is asking for real Scryfall syntax,
// not a fuzzy card-name lookup.
//
// Reference: https://scryfall.com/docs/syntax

export const SCRYFALL_OPERATORS = [
  // Type / color / cost
  "t",
  "type",
  "c",
  "color",
  "ci",
  "id",
  "identity",
  "cmc",
  "mv",
  "manavalue",
  "m",
  "mana",
  // Power / toughness / loyalty
  "pow",
  "power",
  "tou",
  "toughness",
  "loy",
  "loyalty",
  // Oracle text
  "o",
  "oracle",
  "kw",
  "keyword",
  // Sets / printings / artwork
  "s",
  "set",
  "e",
  "edition",
  "year",
  "art",
  "artist",
  "fn",
  "function",
  "otag",
  "atag",
  "frame",
  "border",
  "stamp",
  "rarity",
  "r",
  "lang",
  "language",
  "wm",
  "watermark",
  "number",
  "cn",
  // Legality / format
  "f",
  "format",
  "legal",
  "banned",
  "restricted",
  "game",
  // Boolean tags
  "is",
  "not",
  "in",
  "has",
  // Pricing
  "usd",
  "eur",
  "tix",
  // Behavior flags
  "unique",
  "order",
  "direction",
  "prefer",
  "include",
] as const;

const OPERATOR_SET = new Set<string>(SCRYFALL_OPERATORS);

// Matches `op:`, `op=`, `op<`, `op>`, `op<=`, `op>=`, optionally negated by `-`.
// Op name is captured so we can validate against the known list.
const OPERATOR_PATTERN = /(?:^|\s)-?([a-z][a-z]+)(?::|=|<=|>=|<|>)/gi;

export function detectScryfallSyntax(query: string): boolean {
  if (!query) return false;
  OPERATOR_PATTERN.lastIndex = 0;
  for (const match of query.matchAll(OPERATOR_PATTERN)) {
    const op = match[1]?.toLowerCase();
    if (op && OPERATOR_SET.has(op)) return true;
  }
  return false;
}
