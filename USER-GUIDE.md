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
- [Generate a deck (AI builder)](#generate-a-deck-ai-builder)
- [Trades & ledger](#trades--ledger)
- [Market](#market)
- [Market sources (admin)](#market-sources-admin)
- [Importing a CSV](#importing-a-csv)
- [System status](#system-status)
- [Locations](#locations)
- [Install as an app (PWA)](#install-as-an-app-pwa)
- [Keyboard shortcuts](#keyboard-shortcuts)

---

## Getting around

The top navigation has eight sections: **Dashboard**, **Inventory**,
**Decks**, **Trades**, **Market**, **Import**, **System**, and **Help**.
On phones those links collapse into a hamburger menu in the top-right. The
app is dark by default; the sun/moon button toggles light mode.

Press **⌘K** (Ctrl+K) anywhere to open the card search palette. Card detail
pages, the deckbuilder, and the admin/market-sources page show a back link
in the top-left so you don't have to use the browser back button.

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

The **Decks** page has two tabs:

- **Active** — every saved deck as a tile with its commander, bracket, card
  count, and value. **New deck** creates one — you can assign a commander
  now or later.
- **Builder** — every generated proposal that hasn't been saved as a deck
  yet. Live generations show a pulsing count. Open a proposal to inspect
  it, reconcile it against inventory, or save it (saving moves it to the
  Active tab and exits Builder).

The header has a **Generate** button that opens the AI builder — see
[Generate a deck](#generate-a-deck-ai-builder) below.

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

## Generate a deck (AI builder)

The **Generate** button on the Decks page opens the AI deckbuilder.
Pick a commander, target bracket, and a few flavor hints, then choose:

### Generator kind

- **Standard** — a multi-pass build that scores cards against the
  commander's gameplan, your bracket target, and the standard
  Ramp/Removal/Draw/Wincons slots. Lower-variance output. Good first
  pass.
- **Rogue** — a high-variance build with adversarial critique. The
  generator drafts several distinct theses, picks one (you can
  override), builds it, then runs four independent critique passes
  (critic, premortem, trade, synthesis). The synthesis tab gives you a
  confidence verdict — sometimes the answer is "this thesis doesn't
  hold up, try again." Rogue is the right choice when you want a
  pet-card pile that surprises you.

### Inventory scope

Three choices governing which of your cards the generator can pull
from:

- **Only unassigned** (default) — uses cards you own that aren't
  already committed to another deck. Safest; nothing else of yours
  breaks.
- **All owned** — uses any card you own, even those in another deck.
  The reconciler later flags which other decks would be cannibalized.
- **Disregard inventory** — builds against the entire card pool; treat
  it as a shopping list. The Acquire tab on the resulting deck shows
  what the build would cost.

### After generation

Generated builds land in the **Builder** tab on /decks. Open one to
inspect it; from there you can:

- **Reconcile** against inventory — slot in your own physical cards
  where possible, flag conflicts when a card is already in another
  deck. You decide what to keep.
- **Save as deck** — promotes the proposal to a real deck (moves it to
  Active). The generator's analysis carries forward as the deck's
  Strategy result.
- **Delete** — discards the proposal.

You can re-generate any time without affecting saved decks.

---

## Trades & ledger

The **Trades** page is a chronological transactions ledger. Every
**purchase**, **sale**, or **trade** is a single transaction with one or
more cards on each side, allocated cost basis, and a running realized
P&L. The old "log a trade with a partner" form was replaced by this
unified ledger; purchases and sales now live here too.

### Logging a transaction

Click **New** (top-right). The form opens with three fixed parts plus a
live allocation preview.

1. **Kind** — pick **Purchase**, **Sale**, or **Trade**. The form
   reshapes based on the choice:
   - **Purchase:** only cards coming **in** + cash going out.
   - **Sale:** only cards going **out** + cash coming in.
   - **Trade:** cards on both sides; cash legs are optional (handy when
     a trade has $5 to even out a difference).
2. **Header** — date, counterparty (LGS name, eBay seller handle,
   trade partner — whatever you'll search for later), optional channel
   (eBay / LGS / trade night) and notes.
3. **Lines** — search to add cards. **Going out** searches **your
   inventory** (the physical rows that will be marked disposed).
   **Coming in** searches **any card** in the database. Each incoming
   row picks a condition, foil/etched flags, and a location.

The **Allocation preview** at the bottom is the key insight: when you
enter cash going out, the form distributes that cash across incoming
lines proportionally to each card's market value. That allocated value
becomes the new inventory row's **cost basis**. Rounding cents are
parked on the largest line so the allocation always sums exactly to the
cash total.

For sales, each outgoing line is credited with its share of cash in,
and realized gain = sale proceeds − the line's original cost basis.

### Ledger view

The Trades page shows every transaction with kind pill, counterparty,
date, in/out counts, cash legs, and net value. The right rail
summarizes:

- **Lifetime** — total cash in/out, total realized P&L, breakdowns by
  year.
- **By counterparty** — who you've transacted with most, and whether
  you're net up or down with each.
- **Market drift** — a quick read on how your cost-basis valuations
  compare to current market.

Clicking a row opens the full transaction detail: every line as a
clickable card tile, allocated values, the cost-basis math, and any
notes you logged. Sales show the realized gain on the outgoing line.

### Why the ledger model

A purchase and a sale are both special cases of a trade where one side
is pure cash. By unifying them, the cost basis on every inventory row
flows from a real transaction line — not a guess — and the dashboard's
**unrealized** / **realized** gain numbers stay consistent.

---

## Market

The **Market** page is valuation + bargain hunting in one. Three blocks:

### Sources

A strip listing every active **market source**. The eBay adapter is
built in and self-enables when `EBAY_APP_ID`, `EBAY_CERT_ID`, and
`EBAY_OAUTH_TOKEN` are set in `.env.local`. Additional sources (any
Shopify-based LGS) live in the database and are managed via the
**Manage scrapers** link → [Market sources](#market-sources-admin).

A source shows as **Enabled** (returning data), **Configure to enable**
(missing creds or robots-ack), or absent if you haven't added it. At
least one enabled source is required for Bargains to do anything.

### Bargains

A panel with a **Run sweep** button. Each sweep:

1. Pulls your **want list** (manual entries + deck-need shortfall —
   see below).
2. For every want, queries every enabled source for active listings.
3. Compares each listing's price (plus shipping if reported) against a
   baseline:
   - sold-median when a source has that data (eBay Marketplace
     Insights, once you have access — currently approved-access-only),
   - else 90-day median from your local `price_history` snapshots,
   - else `printings.usd` from Scryfall.
4. Returns listings priced below baseline, ranked by absolute
   savings.

Each bargain row shows the card name, listing title, source, total
cost (price + shipping), baseline comparison, savings (USD + %), and
any **flags** the title heuristics caught — *possible lot*, *graded*,
*non-English*, *playtest/proxy*. Flagged listings are excluded by
default; you can loosen that on a per-want basis when you mean to bid
on a lot.

Listings link out to the source so you can act. Source stats below the
list show "we queried N sources and got X / Y / Z listings" so you can
spot a misbehaving adapter.

### Want list

Wants drive bargain sweeps. Two contributors:

- **Manual** — add a card with an optional target quantity and a
  ceiling price (`max_price_usd`). Sweeps skip listings above your
  ceiling.
- **Deck shortfall** — every Acquire-rollup card across all decks
  contributes. Aggregated globally: if you own 1 Sol Ring and two
  decks each want 1, the want list shows need = 1, not 2.

### Valuation views

Three sections below Bargains, computed against your inventory and the
local price snapshots. No external credentials required.

- **Appreciated cards** — owned cards currently worth ≥25% / ≥$1 more
  than what you paid. Sell signals if you're willing to part with them.
- **Biggest movers this week** — owned cards with the largest 7-day
  price delta from `price_history`. Needs at least a week of snapshots
  to populate — new accounts may show empty.
- **Underwater** — owned cards where current market is ≥10% below
  what you paid. Hold view; useful for cost-basis thinking, not panic.

All three are foil-aware: foiled cards use `usd_foil`, etched use
`usd_etched`.

---

## Market sources (admin)

`/admin/market-sources` (linked from the Market page's Sources strip)
is where you wire up additional scraper sources beyond eBay. Each row
is one **scrape target** with parsing handled by a **parser template**
in code.

### Adding a source

Click **Add source** and fill in:

- **Source key** — lowercase slug used in URLs and cache keys
  (e.g. `example-lgs`).
- **Display name** — what shows on the Market page.
- **Base URL** — the homepage of the LGS. `https://example-lgs.com`,
  not the search URL.
- **Parser template** — currently **Shopify** (uses the standard
  `/search/suggest.json` endpoint). Most LGS webstores run Shopify and
  return clean JSON, so no HTML scraping is needed.
- **Rate limits** — per minute / per day token-bucket caps. Defaults
  (5 / 200) are polite. Raise carefully.
- **Terms notes** — free text where you record what you found in the
  site's robots.txt and terms of service.
- **Robots/terms acknowledged** — required before the source can be
  enabled. You're confirming you've reviewed the target's robots.txt
  and ToS and that scraping is permitted for personal use.
- **Use Bright Data Web Unlocker** — only enable if the target is
  behind anti-bot (Cloudflare etc.). Requires `BRIGHTDATA_API_TOKEN`.
  Most friendly LGS targets work with plain fetch.

After saving, the row defaults to **Disabled**. Click **Test fetch** to
run a Sol Ring probe through the adapter — the result is stored on the
row (`last_test_at`, `last_test_ok`, `last_test_message`). Once a test
returns listings, flip **Enabled** to wire it into the sweep.

### Hostile-marketplace denylist

Adapter creation refuses these targets at the API boundary and again
in code:

- **TCGPlayer** and subdomains
- **Cardmarket**
- **eBay** (the site) — use the official Browse API adapter instead;
  it's built in and self-configures from env vars
- **mtgstocks**

The denylist is a deliberate choice. Scraping any of these violates
their terms, and bad arbitrage data is worse than none.

### How adapters fail

A scrape that errors (timeout, captcha, parse failure) returns an
empty list with an entry in the source-stats footer — **never** fake
data. The token-bucket rate limiter blocks runaway loops. Per-source
failures don't block sibling sources from running.

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
