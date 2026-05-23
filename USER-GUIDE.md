# MTG Vault — User Guide

A personal Magic: The Gathering collection tracker and Commander deckbuilder.

---

## Contents

- [Getting around](#getting-around)
- [Dashboard](#dashboard)
- [Your collection (Inventory)](#your-collection-inventory)
- [Scanning a card](#scanning-a-card)
- [Card pages](#card-pages)
- [Decks](#decks)
- [The deckbuilder](#the-deckbuilder)
- [Trades](#trades)
- [Importing a CSV](#importing-a-csv)
- [System status](#system-status)
- [Locations](#locations)
- [Install as an app (PWA)](#install-as-an-app-pwa)
- [Keyboard shortcuts](#keyboard-shortcuts)

---

## Getting around

The top navigation has seven sections: **Dashboard**, **Inventory**,
**Decks**, **Trades**, **Import**, **System**, and **Help**. On phones
those links collapse into a hamburger menu in the top-right. The app is
dark by default; the sun/moon button toggles light mode.

Press **⌘K** (Ctrl+K) anywhere to open the card search palette. Card detail
pages and the deckbuilder show a back link in the top-left so you don't have
to use the browser back button.

The in-app **Help** page mirrors this guide.

---

## Dashboard

A snapshot of the whole collection:

- **Collection value** — current market value, cost basis, and unrealized
  gain/loss.
- **Value over time** — a chart of market value vs. cost basis from the daily
  snapshots.
- **Decks** — every deck with its target/calculated bracket and value.
- **Insights** — breakdowns by color, card type, and most-represented sets.
- **Most valuable** — your top 20 cards by value.

---

## Your collection (Inventory)

The **Inventory** page lists every card you own. Each database row is one
**physical card** — a playset of four Sol Rings is four rows, not one row
with quantity 4.

### Views

- **Grouped** (default) — one row per card, copies collapsed. The **Sets**
  column shows a symbol for each printing in the group. Click the chevron to
  expand a group and see individual copies.
- **Physical** — one row per physical card, with condition, location, and
  price detail.

### Adding cards

Click **Add cards**, search for a card, pick it, then choose the printing
(filterable by set name/code/collector number) and fill in condition,
location, and acquired price. **Location** is a dropdown sourced from the
canonical list you manage on the **System** page. The **Purchased from**
field autocompletes from vendors and partners you've used before.

For a faster path when you have a physical card in hand, click **Scan**
instead — see [Scanning a card](#scanning-a-card).

### Editing a card

Hover a row and use the **⋯** menu → **Edit**. You can change every detail
including the **printing** — useful if you recorded the wrong set. In the
grouped view, expand the group first; each copy is edited individually.

The **⋯** menu also has **Mark disposed** (sold/traded/lost — recoverable)
and **Delete row** (permanent).

### Filtering & sorting

The filter bar searches by name, set, type, location, and color. Toggle
**Foils only** or **+ Disposed**. Click a column header to sort; sorting by
value uses each card's finish-aware price.

The list loads 200 cards at a time — **Load more** pulls the rest, and a
"Showing N of M" line sits by that button.

### Bulk actions

Tick the checkboxes to select rows. A bar appears at the bottom with:

- **Create deck** — builds a new deck from the selected cards (deduped;
  Commander singletons cap at 1, basic lands keep their count).
- **Dispose** — mark all selected as disposed.

### Export / Import

**Export** downloads your inventory as CSV. **Import CSV** opens the import
wizard (see below).

---

## Scanning a card

The **Scan** button (next to Add cards on the Inventory page) opens the
camera and identifies a physical card from a photo.

1. Tap **Scan**. The browser asks for camera permission — grant it. On
   phones the rear camera is used by default.
2. Fill the dashed frame with the card so the **name is clearly readable**,
   then tap **Capture**.
3. Review the still and tap **Identify** (or **Retake** if it's blurry).
4. The card is identified by Claude vision: name, set code (if visible),
   and confidence level. The matching printing is pre-selected.
5. Tap **Add to inventory** — the regular Add dialog opens with everything
   prefilled, and you fill in condition, location, and price as usual.

If the name comes back blurry or doesn't match an exact card, you'll see
**Did you mean?** suggestions from a fuzzy match. Pick one to hand off to
the Add flow, or retake the photo.

Best results: even, indirect light; one card in the frame; name not
covered by a sleeve or thumb.

---

## Card pages

Clicking a card name opens its detail page:

- The art shows a printing **you own** by default (double-faced cards show
  the front face).
- A red **"Banned in Commander"** tag appears when the card isn't legal in
  the format.
- **Printings** — every printing, filterable, with prices. Click one to view
  its art and details.
- **Price history** — a 90-day chart.
- **Ownership** — your copies, with quick add/edit.
- **Used in decks** — which of your decks run the card.

---

## Decks

The **Decks** page shows every deck as a tile with its commander, bracket,
card count, and value. **New deck** creates one — you can assign a commander
now or later.

---

## The deckbuilder

Opening a deck shows a three-pane workspace (needs a window ≥1024px wide;
narrower viewports get a tabbed Decklist / Search / Detail layout — tapping
a card auto-switches to Detail):

### Left — Search

Search any card in the database (not just cards you own). Filter by color
identity, type, or owned-only (**⌘/** toggles owned-only). Click a result to
add it, or press **Enter** on the highlighted result.

### Middle — Decklist

The deck's cards, grouped by type, with ownership indicators. **Backspace**
removes the selected row. A physical card committed to another deck shows as
unavailable elsewhere. Cards no longer legal in Commander wear a red **Banned**
badge inline, and adding one fires a warning toast (the add still happens —
keep it for casual play or remove later).

### Right — four tabs

- **Detail** — inspects the selected card: oracle text, tags, your owned
  printings. For the commander or any in-deck card, each owned printing has a
  **Use** button to switch the deck to that printing; the one in use is
  marked **"in deck"**.
- **Coach** — a heuristic build check. Every slot (Ramp, Removal, Card draw,
  etc.) is counted against a bracket-aware target. Expand a slot to see
  what's **in the deck** (each with **Remove**, with a count input for
  stacked cards like basics) and **owned candidates** to add. Suggestions
  only show cards you have available — copies already committed to another
  deck don't count, since a physical card can only field one deck.
- **Strategy** — an AI analysis powered by Claude. Click **Analyze deck** for
  archetype, win conditions, a three-phase gameplan, weaknesses,
  **From your inventory** (improvement suggestions you own), and
  **Worth acquiring** (a shopping list regardless of ownership). Requires
  `ANTHROPIC_API_KEY` on the server — if it's missing, the tab explains why
  analysis isn't available. Results are cached; use **Re-analyze** after
  changing the deck. Each *Worth acquiring* card has a **Buy** button that
  adds it to the deck's *considering* category, where it flows into the
  **Acquire** rollup.
- **Acquire** — a cost-to-build rollup: every non-basic card in the deck
  you don't own enough copies of, with a deck-total price. Basic lands are
  excluded. Each row links to its card page.

### Bracket panel

Press **⌘B** (or use the bracket control in the header) to open the bracket
overlay. It shows:

- **Calculated bracket** (1–5) with confidence (calculated, declared, or
  conservative when Commander Spellbook is unreachable)
- **Reasons** grouped by category — game changers, combos, mass land denial,
  extra turns, tutors
- **To reach Bracket N** — suggested removals to drop a bracket, with brief
  rationale per card

Bracket 5 (cEDH) is intent-based. The engine can flag a deck as cEDH-shaped,
but you confirm tournament intent explicitly.

Combo detection uses the live Commander Spellbook API. If Spellbook is down,
the estimate may be conservative and the panel says so.

### Other deckbuilder actions

- **← Decks** in the deckbuilder header — return to the decks list.
- **Export** (in the header menu) — copy the decklist in Moxfield/Archidekt
  text format.
- **⌘S** — save a snapshot of the deck's value and bracket.

The shortcut bar at the bottom of the deckbuilder lists the same keys.

---

## Trades

The **Trades** page logs card-for-card trades with another player and keeps
a running tally per partner.

### Logging a trade

Click **Log trade**. The form has three parts:

1. **Header** — partner name, date, optional notes.
2. **Cards going out** — search **your inventory** and pick the cards
   you're giving away. Each row gets an editable value (defaults to the
   card's current market price).
3. **Cards coming in** — search **any card** and pick the printings you're
   receiving. Each row has condition, foil toggle, location, and value.

A live net total sits at the bottom (in − out). Submitting in a single
transaction:

- marks each outgoing inventory row **disposed** with `disposed_to = "Trade:
  {partner}"`,
- creates a new inventory row per incoming card with `purchased_from =
  "Trade: {partner}"`,
- ties both sides to the same `trade_id` so the trade can be reconstructed
  later.

### Trade history

The Trades page lists every past trade with **↓ out**, **↑ in**, and **net**
per row. A **Lifetime** card sums all-time totals; a **Partners** card
sorts everyone you've traded with by frequency and shows whether you're
net up or down with each.

Click a row to see the full ledger — each card on both sides as clickable
tiles, with the date and any notes you logged.

---

## Importing a CSV

**Import** runs a five-step wizard:

1. **Upload** — drop a CSV (ManaBox, Moxfield, Archidekt, TCGPlayer).
2. **Configure** — pick a default location (from the canonical list) and an
   import mode (**append** or **replace location** — the latter disposes
   existing cards at that location before importing).
3. **Resolve** — fix any ambiguous or unmatched rows.
4. **Confirm** — review the counts.
5. **Done** — the cards are in your inventory.

Each imported quantity becomes one inventory row per physical card.

**Import history** (link on the Import page) lists every batch and lets you
**Undo** one — it removes the rows that batch created and restores anything
it disposed.

---

## System status

The **System** page reports app health:

- **Card database** — card/printing counts, newest set, last full sync.
- **Bracket flags** — counts of game-changers, tutors, etc., and the last
  flag refresh.
- **Collection & activity** — inventory, deck, snapshot, and import stats.
- **Locations** — manage the canonical list (see next section).

The full card database refreshes **weekly** from Scryfall (GitHub Action).
Daily jobs update collection value snapshots and bracket-related flags.

---

## Locations

Storage locations available when adding or editing inventory cards (and
when configuring a CSV import) come from a canonical list managed on the
**System** page. Seeded with Trade Binder, Kabinka Box, and Card Box, plus
any locations already in use.

- Each row shows how many inventory cards currently have that location.
- **Add** a location with the input and Add button.
- **Delete** a location — removes it from the dropdown **and** clears the
  location from any inventory cards still using it (they revert to no
  location). The confirm dialog tells you exactly how many cards will be
  affected.
- The Add/Edit Location dropdown still includes a row's current value as an
  option in case a card carries a value that's no longer in the canonical
  list (e.g. a card edited just before the location was deleted).

---

## Install as an app (PWA)

MTG Vault is a Progressive Web App, so you can install it to your phone
or desktop and run it without a browser chrome.

- **iOS Safari:** Share → **Add to Home Screen**.
- **Android Chrome:** the address bar offers an **Install** prompt the
  first time you visit; otherwise the menu has **Add to Home screen**.
- **Desktop Chrome/Edge:** the address bar shows an install icon on the
  right; clicking it adds the app to your launcher.

Once installed, the app caches its shell + Scryfall card images, so the
inventory pages you've already loaded remain readable even with no
connection. Mutations (adding cards, logging trades, etc.) still require
the network.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K / Ctrl+K | Open card search (global) |
| / | Focus search (in the deckbuilder) |
| Enter | Add highlighted search result (in the deckbuilder) |
| Backspace | Remove selected decklist row (in the deckbuilder) |
| ⌘/ | Toggle owned-only filter (in the deckbuilder) |
| ⌘B | Bracket panel (in the deckbuilder) |
| ⌘S | Save deck snapshot (in the deckbuilder) |
| Esc | Clear the selected card |
