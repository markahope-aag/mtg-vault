# MTG Vault — User Guide

A personal Magic: The Gathering collection tracker and Commander deckbuilder.

---

## Contents

- [Getting around](#getting-around)
- [Dashboard](#dashboard)
- [Your collection (Inventory)](#your-collection-inventory)
- [Card pages](#card-pages)
- [Decks](#decks)
- [The deckbuilder](#the-deckbuilder)
- [Importing a CSV](#importing-a-csv)
- [System status](#system-status)
- [Locations](#locations)
- [Keyboard shortcuts](#keyboard-shortcuts)

---

## Getting around

The top navigation has six sections: **Dashboard**, **Inventory**, **Decks**,
**Import**, **System**, and **Help**. The app is dark by default; the
sun/moon button in the top-right toggles light mode.

Press **⌘K** (Ctrl+K) anywhere to open the card search palette. Card detail
pages and the deckbuilder show a back link in the top-left so you don't have
to use the browser back button.

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

The **Inventory** page lists every card you own.

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
canonical list you manage on the **System** page.

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

Opening a deck shows a three-pane workspace (needs a window ≥1024px wide):

### Left — Search

Search any card in the database (not just cards you own). Filter by color
identity, type, or owned-only. Click a result to add it.

### Middle — Decklist

The deck's cards, grouped by type, with ownership indicators.

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
- **Strategy** — an AI analysis (Claude). Click **Analyze deck** for
  archetype, win conditions, a three-phase gameplan, weaknesses,
  **From your inventory** (improvement suggestions you own), and
  **Worth acquiring** (a shopping list regardless of ownership). Each
  *Worth acquiring* card has a **Buy** button that adds it to the deck's
  *considering* category, where it flows into the **Acquire** rollup.
- **Acquire** — a cost-to-build rollup: every non-basic card in the deck
  you don't own enough copies of, with a deck-total price. Each row links
  to its card page.

### Other deckbuilder actions

- **← Decks** in the deckbuilder header — return to the decks list.
- **Export** (in the header menu) — copy the decklist in Moxfield/Archidekt
  text format.
- **⌘B** — open the bracket panel (power-level estimate and reasons).
- **⌘S** — save a snapshot of the deck's value and bracket.

---

## Importing a CSV

**Import** runs a five-step wizard:

1. **Upload** — drop a CSV (ManaBox, Moxfield, Archidekt, TCGPlayer).
2. **Configure** — pick a default location (from the canonical list) and an
   import mode.
3. **Resolve** — fix any ambiguous or unmatched rows.
4. **Confirm** — review the counts.
5. **Done** — the cards are in your inventory.

**Import history** lists every batch and lets you **Undo** one — it removes
the rows it created and restores anything it disposed.

---

## System status

The **System** page reports app health:

- **Card database** — card/printing counts, newest set, last full sync.
- **Bracket flags** — counts of game-changers, tutors, etc., and the last
  flag refresh.
- **Collection & activity** — inventory, deck, snapshot, and import stats.
- **Locations** — manage the canonical list (see next section).

The full card database refreshes weekly from Scryfall; prices and the daily
value snapshot update on their own schedule.

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

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K / Ctrl+K | Open card search |
| / | Focus search (in the deckbuilder) |
| ⌘B | Bracket panel (in the deckbuilder) |
| ⌘S | Save deck snapshot (in the deckbuilder) |
| Esc | Clear the selected card |
