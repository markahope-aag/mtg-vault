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
        text: "The top navigation has eight sections: Dashboard, Inventory, Decks, Trades, Market, Import, System, and Help. The app is dark by default — the sun/moon button in the top-right toggles light mode.",
      },
      {
        type: "p",
        text: "Press Cmd+K (or Ctrl+K) anywhere to open the card search palette. Card detail pages, the deckbuilder, and the admin/market-sources page show a back link in the top-left so you don't have to use the browser back button. This Help page mirrors the USER-GUIDE in the repo.",
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
        text: "The Decks page has two tabs. Active shows every saved deck as a tile with commander, bracket, card count, and value — New deck creates one (commander optional). Builder shows every generated proposal that hasn't been saved yet; live generations pulse. Open a proposal to inspect, reconcile, or save it (saving moves it to Active).",
      },
      {
        type: "p",
        text: "The header also has a Generate button — see the next section.",
      },
    ],
  },
  {
    id: "deckbuilder-generate",
    title: "Generate a deck (AI builder)",
    blocks: [
      {
        type: "p",
        text: "Generate opens the AI builder. Pick a commander, target bracket, and flavor hints, then choose a kind and an inventory scope. Standard is a multi-pass build scoring cards against the gameplan and standard slots — lower variance, good first pass. Rogue is a high-variance build with adversarial critique: it drafts several theses, picks one (you can override), then runs four independent critique passes and gives you a confidence verdict. Rogue is the right pick when you want a surprising pet-card pile.",
      },
      {
        type: "p",
        text: "Inventory scope controls which of your cards the generator can use. Only unassigned (default) uses cards not committed to another deck. All owned uses anything you own — the reconciler later flags conflicts with other decks. Disregard inventory builds against the full card pool; treat it as a shopping list.",
      },
      {
        type: "p",
        text: "Generated builds land in the Builder tab. Open one to reconcile against inventory, save as a deck (moves it to Active and carries the generator's analysis forward as the deck's Strategy), or delete. Re-generating never affects saved decks.",
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
    title: "Trades & ledger",
    blocks: [
      {
        type: "p",
        text: "The Trades page is a chronological transactions ledger. Every purchase, sale, or trade is a single transaction with cards on one or both sides, allocated cost basis, and a running realized P&L. The legacy partner-only form is gone — purchases and sales now live here too.",
      },
      {
        type: "p",
        text: "Click New to log a transaction. Pick a Kind (Purchase, Sale, or Trade) and the form reshapes: Purchase has cards in + cash out; Sale has cards out + cash in; Trade has both sides with optional cash legs (handy for $5 to even out a difference). Add a date, counterparty (LGS, eBay seller, trade partner), channel, and notes. Then search to add lines — going out searches your inventory, coming in searches any card.",
      },
      {
        type: "p",
        text: "The Allocation preview at the bottom is the key insight: cash going out is distributed across incoming lines proportional to each card's market value, and that allocated value becomes the new inventory row's cost basis. Rounding cents park on the largest line so allocations always sum exactly to the cash total. For sales, each outgoing line is credited with its share of cash in, and realized gain = sale proceeds − the line's original cost basis.",
      },
      {
        type: "p",
        text: "The ledger view shows every transaction with kind pill, counterparty, date, in/out counts, cash legs, and net value. The right rail summarizes Lifetime totals (in/out/realized + by-year breakdown), By counterparty (who you've transacted with most and net up/down per person), and Market drift (how cost-basis valuations compare to current market). Click any row to see the full transaction detail with line-by-line cost-basis math and realized gain on sales.",
      },
    ],
  },
  {
    id: "market",
    title: "Market",
    blocks: [
      {
        type: "p",
        text: "The Market page is valuation + bargain hunting. The Sources strip at the top lists active market sources. The eBay adapter is built in and self-enables when EBAY_APP_ID, EBAY_CERT_ID, and EBAY_OAUTH_TOKEN are set. Additional sources (any Shopify-based LGS) live in the database and are managed via the Manage scrapers link.",
      },
      {
        type: "p",
        text: "The Bargains panel has a Run sweep button. Each sweep pulls your want list (manual + deck-need shortfall), queries every enabled source for each want, and compares listings against a baseline — sold median when available, else 90-day price-history median, else printings.usd. Listings priced below baseline are ranked by absolute savings.",
      },
      {
        type: "p",
        text: "Each bargain row shows source, total cost (price + shipping), baseline comparison, and any flags the title heuristics caught: possible lot, graded, non-English, playtest/proxy. Flagged listings are excluded by default. Source stats below show how many listings each source returned so you can spot a broken adapter.",
      },
      {
        type: "p",
        text: "Three valuation sections sit below Bargains, all computed locally from your inventory and the price-history snapshots — no external credentials required. Appreciated cards (≥25% / ≥$1 above what you paid; sell signal). Biggest movers this week (largest 7-day price delta on owned cards; needs at least a week of snapshots). Underwater (≥10% below cost basis; hold view, not panic). All foil-aware.",
      },
    ],
  },
  {
    id: "market-sources",
    title: "Market sources (admin)",
    blocks: [
      {
        type: "p",
        text: "/admin/market-sources is where you wire up scraper sources beyond eBay. Each row is one scrape target; parsing is handled by a parser template in code (currently Shopify). Adding a source requires source key (slug), display name, base URL, parser template, per-minute/per-day rate limits, terms notes, and a robots/terms acknowledgment checkbox that must be ticked before the source can be enabled.",
      },
      {
        type: "p",
        text: "After saving, the row starts disabled. Click Test fetch to run a Sol Ring probe — the result is stored on the row (last_test_at, last_test_ok, last_test_message). Once a test returns listings, flip Enabled to include the source in bargain sweeps. Bright Data Web Unlocker is an opt-in toggle for targets behind anti-bot; needs BRIGHTDATA_API_TOKEN.",
      },
      {
        type: "p",
        text: "A hostile-marketplace denylist refuses adapters for TCGPlayer, Cardmarket, ebay.com, and mtgstocks at the API boundary and again in code. eBay goes through the official Browse API instead (it's built in). The denylist is deliberate — scraping those sites violates their terms, and bad arbitrage data is worse than none. Scrapes that error return empty + log; they never fake data.",
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
