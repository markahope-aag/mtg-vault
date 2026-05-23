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
        text: "Press Cmd+K (or Ctrl+K) anywhere to open the card search palette. Card detail pages and the deckbuilder show a back link in the top-left so you don't have to use the browser back button. This Help page mirrors the USER-GUIDE in the repo.",
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
        text: "The Inventory page lists every card you own — one database row per physical card. Grouped view (default) shows one row per card with copies collapsed and a Sets column of printing symbols — expand a group to see individual copies. Physical view shows one row per physical card with condition, location, and price detail.",
      },
      {
        type: "p",
        text: "To add cards, click Add cards, search for a card, pick it, then choose the printing (filterable by set name, code, or collector number) and fill in condition, location, and acquired price. The card appears in the list immediately. Location is a dropdown sourced from the canonical list you manage on the System page. Purchased from autocompletes from vendors you've used before.",
      },
      {
        type: "p",
        text: "For a faster path when you have a physical card in hand, click Scan instead — see the next section.",
      },
    ],
  },
  {
    id: "scanning",
    title: "Scanning a card with the camera",
    blocks: [
      {
        type: "p",
        text: "The Scan button (next to Add cards on the Inventory page) opens the camera and identifies a physical card from a photo. Best results: even, indirect light; one card in frame; name not covered by a sleeve or thumb.",
      },
      {
        type: "list",
        items: [
          "Tap Scan. The browser asks for camera permission — grant it. On phones the rear camera is used by default.",
          "Fill the dashed frame with the card so the name is clearly readable, then tap Capture.",
          "Review the still and tap Identify (or Retake if it's blurry).",
          "The card is identified by Claude vision: name, set code if visible, and a confidence level. The matching printing is pre-selected.",
          "Tap Add to inventory — the regular Add dialog opens with everything prefilled.",
        ],
      },
      {
        type: "p",
        text: "If the name comes back blurry or doesn't match an exact card, you'll see Did you mean? suggestions from a fuzzy match. Pick one to hand off to the Add flow, or retake the photo.",
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
        text: "The filter bar searches by name, set, type, location, and color, with toggles for Foils only, Banned only (cards no longer legal in Commander), and disposed cards. Click a column header to sort; sorting by value uses each card's finish-aware price. The list loads 200 cards at a time — Load more pulls the rest, and a 'Showing N of M' line keeps you oriented.",
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
        text: "Clicking a card name opens its detail page. The art shows a printing you own by default. Double-faced cards show the front face. If the card isn't legal in Commander, a red 'Banned in Commander' tag is displayed.",
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
        text: "Opening a deck shows a three-pane workspace (needs a window at least 1024px wide; narrower viewports get a tabbed Decklist / Search / Detail layout). The left pane searches any card in the database — not just cards you own — with filters for color identity, type, and owned-only (Cmd+/ toggles owned-only). Click a result or press Enter to add it. The middle pane is the decklist, grouped by type with ownership indicators; Backspace removes the selected row. Cards flagged 'Banned' show a red badge inline, and adding a banned card fires a warning toast — the add still happens, you can keep it for casual play and remove later.",
      },
      {
        type: "p",
        text: "The deck header has a '← Decks' link, the deck name, and an Export action (copy the decklist in Moxfield/Archidekt text format). Cmd+B opens the bracket panel; Cmd+S saves a snapshot of the deck's value and bracket. The right rail has four tabs: Detail, Coach, Strategy, and Acquire. A shortcut bar at the bottom lists the same keys.",
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
        text: "The Coach is a heuristic build check. Every slot — Ramp, Removal, Card draw, Tutors, and so on — is counted against a target range that scales with the deck's bracket. Counts update automatically as you add and remove cards.",
      },
      {
        type: "p",
        text: "Expand a slot to see what's currently in the deck and owned candidates to add. The 'N available' badge is uncommitted copies — copies already in another deck don't count, since a physical card can only field one deck. Basic lands have a quantity input on both sides; you can never add more than you have available.",
      },
      {
        type: "p",
        text: "Each in-deck card has a Remove button. For stacked cards (basic lands), a count input lets you drop a specific number; the row only disappears when the quantity hits zero.",
      },
    ],
  },
  {
    id: "deckbuilder-strategy",
    title: "Deckbuilder: Strategy tab",
    blocks: [
      {
        type: "p",
        text: "The Strategy tab is an AI analysis powered by Claude. Click Analyze deck for an archetype read, win conditions, a three-phase gameplan, and weaknesses. Requires ANTHROPIC_API_KEY on the server — if it's missing, the tab explains why analysis isn't available. The analysis is cached; use Re-analyze after changing the deck.",
      },
      {
        type: "p",
        text: "Two suggestion lists round it out: From your inventory — owned cards that would improve the deck, each with an Add button — and Worth acquiring, best-in-slot recommendations regardless of ownership. The Buy button on a Worth acquiring suggestion adds the card to the deck's 'considering' category, where it flows into the Acquire rollup as a shopping target.",
      },
    ],
  },
  {
    id: "deckbuilder-acquire",
    title: "Deckbuilder: Acquire tab",
    blocks: [
      {
        type: "p",
        text: "The Acquire tab is a cost-to-build rollup: every non-basic card in the deck you don't own enough copies of, with the shortfall quantity, unit price, and a deck total. Basic lands are excluded (those are free). Each row links to the card page.",
      },
      {
        type: "p",
        text: "Building a theoretical deck from cards you don't own is a real workflow — search adds any card, and this panel tells you what assembling the deck would cost. Strategy's Buy button drops cards straight in.",
      },
    ],
  },
  {
    id: "deckbuilder-bracket",
    title: "Deckbuilder: Bracket panel",
    blocks: [
      {
        type: "p",
        text: "Press Cmd+B to open the bracket overlay. It shows the calculated bracket (1–5), confidence level, reasons grouped by category (game changers, combos, mass land denial, extra turns, tutors), and suggested removals to drop a bracket.",
      },
      {
        type: "p",
        text: "Bracket 5 (cEDH) is intent-based — you confirm tournament intent explicitly. Combo detection uses the live Commander Spellbook API; if Spellbook is unreachable, the estimate may be conservative and the panel says so.",
      },
    ],
  },
  {
    id: "trades",
    title: "Trades",
    blocks: [
      {
        type: "p",
        text: "The Trades page logs card-for-card trades with another player and keeps a running tally per partner. Click Log trade to open the form: header (partner name, date, optional notes), then Cards going out (searches your inventory) and Cards coming in (searches every card). Each row carries a value; a live net total sits at the bottom.",
      },
      {
        type: "p",
        text: "Submitting in a single transaction marks each outgoing inventory row disposed with disposed_to = 'Trade: {partner}', creates a new inventory row per incoming card with purchased_from = 'Trade: {partner}', and ties both sides to the same trade so the event can be reconstructed later.",
      },
      {
        type: "p",
        text: "The history list shows ↓ out / ↑ in / net per row. A Lifetime card sums all-time totals; a Partners card sorts everyone you've traded with by frequency and shows whether you're net up or down with each. Click a row to see the full ledger.",
      },
    ],
  },
  {
    id: "importing",
    title: "Importing a CSV",
    blocks: [
      {
        type: "p",
        text: "The Import page runs a five-step wizard: Upload a CSV (ManaBox, Moxfield, Archidekt, or TCGPlayer), Configure a default location (from the canonical list) and import mode (append or replace location), Resolve any ambiguous or unmatched rows, Confirm the counts, and Done. Each imported quantity becomes one inventory row per physical card.",
      },
      {
        type: "p",
        text: "Import history (link on the Import page) lists every batch and lets you Undo one — it removes the rows that batch created and restores anything it disposed.",
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
        text: "The full card database refreshes weekly from Scryfall (GitHub Action). Daily jobs update collection value snapshots and bracket-related flags.",
      },
    ],
  },
  {
    id: "locations",
    title: "Locations",
    blocks: [
      {
        type: "p",
        text: "The Locations section on the System page manages the dropdown options shown when adding or editing inventory cards (and when configuring an import). Seeded with Trade Binder, Kabinka Box, and Card Box, plus any locations already in use. Each row shows how many inventory cards currently have that location.",
      },
      {
        type: "p",
        text: "Add a new location with the input and Add button. Delete a location with the Delete action — that removes it from the dropdown AND clears the location from any inventory cards still using it (they revert to no location). The confirm dialog tells you exactly how many cards will be affected before you commit.",
      },
    ],
  },
  {
    id: "install",
    title: "Install as an app (PWA)",
    blocks: [
      {
        type: "p",
        text: "MTG Vault is a Progressive Web App, so you can install it to your phone or desktop and run it without browser chrome. iOS Safari: Share → Add to Home Screen. Android Chrome: the address bar offers an Install prompt the first time you visit; otherwise the menu has Add to Home screen. Desktop Chrome/Edge: an install icon appears at the right of the address bar.",
      },
      {
        type: "p",
        text: "Once installed, the app caches its shell and Scryfall card images, so previously-loaded pages remain readable with no connection. Mutations (adding cards, logging trades, etc.) still require the network.",
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
          "Cmd+K or Ctrl+K — open card search (global)",
          "/ — focus search (in the deckbuilder)",
          "Enter — add highlighted search result (in the deckbuilder)",
          "Backspace — remove selected decklist row (in the deckbuilder)",
          "Cmd+/ — toggle owned-only filter (in the deckbuilder)",
          "Cmd+B — bracket panel (in the deckbuilder)",
          "Cmd+S — save deck snapshot (in the deckbuilder)",
          "Esc — clear the selected card",
        ],
      },
    ],
  },
];
