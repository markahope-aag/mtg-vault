// Structured user-guide content powering the /help page. Kept in sync with
// USER-GUIDE.md at the repo root.

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

export type HelpSection = {
  id: string;
  title: string;
  blocks: HelpBlock[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-around",
    title: "Getting around",
    blocks: [
      {
        type: "p",
        text: "The top navigation has six sections: Dashboard, Inventory, Decks, Import, System, and Help. The app is dark by default — the sun/moon button in the top-right toggles light mode.",
      },
      {
        type: "p",
        text: "Press Cmd+K (or Ctrl+K) anywhere to open the card search palette.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    blocks: [
      { type: "p", text: "A snapshot of your whole collection." },
      {
        type: "list",
        items: [
          "Collection value — current market value, cost basis, and unrealized gain or loss.",
          "Value over time — a chart of market value versus cost basis from the daily snapshots.",
          "Decks — every deck with its target and calculated bracket, and value.",
          "Insights — breakdowns by color, card type, and most-represented sets.",
          "Most valuable — your top 20 cards by value.",
        ],
      },
    ],
  },
  {
    id: "inventory-views",
    title: "Your collection: views and adding cards",
    blocks: [
      {
        type: "p",
        text: "The Inventory page lists every card you own. Grouped view (default) shows one row per card with copies collapsed and a Sets column of printing symbols — expand a group to see individual copies. Physical view shows one row per physical card with condition, location, and price detail.",
      },
      {
        type: "p",
        text: "To add cards, click Add cards, search for a card, pick it, then choose the printing (filterable by set name, code, or collector number) and fill in condition, location, and acquired price. The card appears in the list immediately.",
      },
    ],
  },
  {
    id: "inventory-editing",
    title: "Your collection: editing, filtering, bulk actions",
    blocks: [
      {
        type: "p",
        text: "Hover a row and use the three-dot menu to Edit, Mark disposed (sold, traded, or lost — recoverable), or Delete the row. Edit can change every detail including the printing, so you can correct a wrong set. In grouped view, expand the group first — each copy is edited individually.",
      },
      {
        type: "p",
        text: "The filter bar searches by name, set, type, location, and color, with toggles for Foils only and disposed cards. Click a column header to sort; sorting by value uses each card's finish-aware price. The list loads 200 cards at a time — Load more pulls the rest.",
      },
      {
        type: "p",
        text: "Tick the checkboxes to select rows. A bar appears at the bottom: Create deck builds a new deck from the selected cards, and Dispose marks them all disposed. Export downloads your inventory as CSV.",
      },
    ],
  },
  {
    id: "card-pages",
    title: "Card pages",
    blocks: [
      {
        type: "p",
        text: "Clicking a card name opens its detail page. The art shows a printing you own by default.",
      },
      {
        type: "list",
        items: [
          "Printings — every printing, filterable, with prices. Click one to view its art.",
          "Price history — a 90-day price chart.",
          "Ownership — your copies, with quick add and edit.",
          "Used in decks — which of your decks run the card.",
        ],
      },
    ],
  },
  {
    id: "decks",
    title: "Decks",
    blocks: [
      {
        type: "p",
        text: "The Decks page shows every deck as a tile with its commander, bracket, card count, and value. New deck creates one — you can assign a commander now or later.",
      },
    ],
  },
  {
    id: "deckbuilder-layout",
    title: "The deckbuilder: layout and search",
    blocks: [
      {
        type: "p",
        text: "Opening a deck shows a three-pane workspace (needs a window at least 1024px wide). The left pane searches any card in the database — not just cards you own — with filters for color identity, type, and owned-only. Click a result to add it. The middle pane is the decklist, grouped by type with ownership indicators.",
      },
      {
        type: "p",
        text: "The deck header menu has Export (copy the decklist in Moxfield/Archidekt text format). Cmd+B opens the bracket panel; Cmd+S saves a snapshot of the deck's value and bracket.",
      },
    ],
  },
  {
    id: "deckbuilder-detail",
    title: "Deckbuilder: Detail tab",
    blocks: [
      {
        type: "p",
        text: "The Detail tab inspects the selected card — oracle text, tags, and your owned printings. For the commander or any in-deck card, each owned printing has a Use button to switch the deck to that printing; the one currently in use is marked 'in deck'.",
      },
    ],
  },
  {
    id: "deckbuilder-coach",
    title: "Deckbuilder: Coach tab",
    blocks: [
      {
        type: "p",
        text: "The Coach is a heuristic build check. Every slot — Ramp, Removal, Card draw, Tutors, and so on — is counted against a target range that scales with the deck's bracket.",
      },
      {
        type: "p",
        text: "Expand a slot to see what's currently in the deck (each with a Remove control) and owned candidates to add. Basic lands have a quantity input and show how many you own; the Coach never adds or recommends more copies than you have.",
      },
    ],
  },
  {
    id: "deckbuilder-strategy",
    title: "Deckbuilder: Strategy tab",
    blocks: [
      {
        type: "p",
        text: "The Strategy tab is an AI analysis. Click Analyze deck for an archetype read, win conditions, a three-phase gameplan, and weaknesses.",
      },
      {
        type: "p",
        text: "It also lists From your inventory — improvement suggestions drawn from cards you own — and Worth acquiring, a shopping list of strong cards regardless of ownership. The analysis is cached; use Re-analyze after changing the deck.",
      },
    ],
  },
  {
    id: "deckbuilder-acquire",
    title: "Deckbuilder: Acquire tab",
    blocks: [
      {
        type: "p",
        text: "The Acquire tab is a cost-to-build rollup: every non-basic card in the deck you don't own enough copies of, with the shortfall quantity, unit price, and a total. It makes building a theoretical deck from cards you don't own a real workflow — search adds any card, and this panel tells you what assembling it would cost.",
      },
    ],
  },
  {
    id: "importing",
    title: "Importing a CSV",
    blocks: [
      {
        type: "p",
        text: "The Import page runs a five-step wizard: Upload a CSV (ManaBox, Moxfield, Archidekt, or TCGPlayer), Configure a default location and import mode, Resolve any ambiguous or unmatched rows, Confirm the counts, and Done.",
      },
      {
        type: "p",
        text: "Import history lists every batch and lets you Undo one — it removes the rows that batch created and restores anything it disposed.",
      },
    ],
  },
  {
    id: "system",
    title: "System status",
    blocks: [
      {
        type: "p",
        text: "The System page reports app health: card and printing counts, the newest set, the last full sync, bracket-flag counts, and collection, deck, and import statistics.",
      },
      {
        type: "p",
        text: "The full card database refreshes weekly from Scryfall; the daily value snapshot updates on its own schedule.",
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    blocks: [
      {
        type: "list",
        items: [
          "Cmd+K or Ctrl+K — open card search",
          "/ — focus search (in the deckbuilder)",
          "Cmd+B — bracket panel (in the deckbuilder)",
          "Cmd+S — save deck snapshot (in the deckbuilder)",
          "Esc — clear the selected card",
        ],
      },
    ],
  },
];
