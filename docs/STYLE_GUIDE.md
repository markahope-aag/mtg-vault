# MTG Vault — Style Guide

Design direction: **Trading Desk.** This app tracks a collection as an asset
— per-card cost basis, market value, realized/unrealized gains, disposal
history. The aesthetic reflects that: dense, data-forward, professional. Dark
by default for long sessions. The five MTG mana colours serve a functional
purpose (color identity), not a decorative one.

Live review surface: [`/style-guide`](../src/app/(app)/style-guide/page.tsx).

---

## Principles

1. **Tokens are the only source of color.** Components must never reach for
   raw hex or `oklch()` values. Use the `bg-surface-raised`, `text-text-muted`,
   `border-border-subtle` etc. utilities, or `var(--color-*)` inline when a
   utility doesn't exist.
2. **Data is the hero.** Chrome is restrained. Borders are subtle. Shadows are
   used sparingly — elevation is mostly conveyed by border + surface contrast.
3. **Tabular figures everywhere numbers matter.** Prices, counts, deltas, IDs,
   collector numbers, brackets. Use `font-mono` (IBM Plex Mono) +
   `tabular-nums` together — the `.num` utility class does both.
4. **Green up, red down.** Financial convention. Always.
5. **No layout reflow on theme toggle.** Dark and light are token swaps only;
   no element should change size or position.

---

## Tokens

All tokens live in [`src/app/globals.css`](../src/app/globals.css) as CSS custom
properties. Tailwind v4's `@theme inline` block exposes them as utilities.

### Surfaces

| Token | Use |
|---|---|
| `--color-surface-base` (`bg-background`) | Page background — deepest layer. |
| `--color-surface-raised` (`bg-card`) | Cards, panels, list items. |
| `--color-surface-overlay` (`bg-popover`) | Modals, popovers, dropdowns. |
| `--color-surface-inset` | Table headers, wells, secondary regions inside a card. |

### Borders

| Token | Use |
|---|---|
| `--color-border-subtle` (`border-border-subtle`) | Default — table rows, card edges. |
| `--color-border-strong` (`border-border-strong`) | Active states, focus indicators, intentional emphasis. |

### Text

| Token | Use |
|---|---|
| `--color-text-primary` (`text-text-primary`) | Card names, headings, primary content. |
| `--color-text-secondary` (`text-text-secondary`) | Type lines, supporting copy. |
| `--color-text-muted` (`text-text-muted`) | Captions, labels, deemphasized numerics, helper text. |
| `--color-text-disabled` | Disabled inputs/buttons. Avoid using directly — set `disabled` on the element. |

### Brand

The brand accent is a **refined amber/gold**. Bloomberg-adjacent without being
on-the-nose. Use for primary actions and active states only.

| Token | Use |
|---|---|
| `--color-brand` | Primary buttons, active filters, the bracket-target highlight. |
| `--color-brand-strong` | Hover state for brand surfaces. |
| `--color-brand-soft` | Subtle brand-tinted backgrounds (e.g. brand-themed badges). |

### Value semantics (financial)

| Token | Use |
|---|---|
| `--color-value-positive` | Green. Unrealized gains, "+$X.XX", arrow-up. |
| `--color-value-negative` | Red. Unrealized losses, "−$X.XX", arrow-down. |
| `--color-value-neutral` | Used when value is exactly zero or unknown. |

Prefer the [`<ValueDelta>`](../src/components/value-delta.tsx) component over
hand-styling these.

### MTG color identity

Used for mana pips, identity displays, and decorative accents tied to a
card's colors.

| Token | Color |
|---|---|
| `--color-mtg-white` | Plains |
| `--color-mtg-blue` | Island |
| `--color-mtg-black` | Swamp |
| `--color-mtg-red` | Mountain |
| `--color-mtg-green` | Forest |
| `--color-mtg-colorless` | Wastes / generic |
| `--color-mtg-multicolor` | Gold (multicolor) |

For rendering actual mana symbols, use
[`<ManaCost cost="{2}{W}{U}" />`](../src/components/mana-cost.tsx) — it uses the
Mana-font library and respects the standard symbol shapes.

### Bracket scale

The five official Commander brackets, color-coded consistently across the app.

| Token | Bracket | Color |
|---|---|---|
| `--color-bracket-1` | Exhibition | Stone gray |
| `--color-bracket-2` | Core | Green |
| `--color-bracket-3` | Upgraded | Amber |
| `--color-bracket-4` | Optimized | Orange |
| `--color-bracket-5` | cEDH | Red |

Use [`<BracketBadge bracket={3} />`](../src/components/bracket-badge.tsx) — never
roll your own.

### Ownership

| Token | Meaning |
|---|---|
| `--color-owned-available` | Owned and not committed to another deck. |
| `--color-owned-committed` | Owned but already assigned elsewhere. |
| `--color-unowned` | Not in inventory. |

### Rarity

| Token | Symbol color |
|---|---|
| `--color-rarity-common` | Black |
| `--color-rarity-uncommon` | Silver |
| `--color-rarity-rare` | Gold |
| `--color-rarity-mythic` | Orange-red |

[`<SetSymbol setCode="neo" rarity="mythic" />`](../src/components/set-symbol.tsx)
handles both the symbol and the rarity tint via Keyrune.

---

## Typography

Three faces, all via `next/font` (Google-hosted, self-served, no FOUC).

| Role | Family | Use |
|---|---|---|
| Display / body | **IBM Plex Sans** | All UI text, headings, body copy. |
| Numerics / mono | **IBM Plex Mono** | Prices, counts, brackets, dates, deltas, collector numbers, set codes — anything in a column that needs to align. |

### Scale

Lean on Tailwind's text utilities; don't invent new sizes. Common roles:

| Role | Class | When |
|---|---|---|
| Display | `text-[32px] font-semibold tracking-tight` | Page hero (rare). |
| H1 | `text-2xl font-semibold tracking-tight` | Page titles. |
| H2 | `text-lg font-semibold` | Card titles, section headings. |
| Body | `text-sm` | Standard prose. |
| Body small | `text-xs` | Subline, captions adjacent to a value. |
| Caption | `font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted` | Labels above values, internal markers. |
| Numeric | `font-mono text-[13px] tabular-nums` | Prices, deltas, counts. |

### Headings

`h1`, `h2`, `h3` are styled globally via the base layer to be
`font-semibold tracking-tight`. You can override per-instance with classes; you
should not need to set those two utilities manually on every heading.

---

## Components

| Component | Path | Purpose |
|---|---|---|
| `ManaCost` | [`src/components/mana-cost.tsx`](../src/components/mana-cost.tsx) | Real Mana-font symbols (mono, hybrid, Phyrexian, generic, tap). |
| `ColorIdentityPips` | same file | Renders a card's color identity using the same Mana-font symbols, without cost-circle outlines. |
| `SetSymbol` | [`src/components/set-symbol.tsx`](../src/components/set-symbol.tsx) | Keyrune set symbol with rarity tint. |
| `ValueDelta` | [`src/components/value-delta.tsx`](../src/components/value-delta.tsx) | Green/red gain/loss with up/down arrow. |
| `BracketBadge` | [`src/components/bracket-badge.tsx`](../src/components/bracket-badge.tsx) | Bracket pill using the bracket-N tokens. |
| `ThemeToggle` | [`src/components/theme-toggle.tsx`](../src/components/theme-toggle.tsx) | Dark/light toggle, cookie-persisted. |

### Usage examples

```tsx
// Mana cost — drop in anywhere a card cost is rendered.
<ManaCost cost="{2}{W}{U}" size="sm" />

// Color identity pips — for deck headers, deck tiles.
<ColorIdentityPips identity={card.colorIdentity} />

// Set symbol — in printing lists, inventory tables.
<SetSymbol setCode={printing.setCode} rarity={printing.rarity} />

// Value delta — anywhere a gain/loss is shown.
<ValueDelta value={142.5} />                    // +$142.50 ▲ in green
<ValueDelta value={-38} />                      // −$38.00 ▼ in red
<ValueDelta value={0} />                        // $0.00 neutral

// Bracket badge.
<BracketBadge bracket={3} showName />           // "B3 Upgraded" amber
<BracketBadge bracket={null} prefix="Target" /> // "Target —"
```

---

## Patterns

### Data tables

Inventory, deck list, decks-overview table — all use the same conventions:

- Header row: `font-mono text-[10px] uppercase tracking-wide text-text-muted bg-surface-inset`.
- Numeric columns: right-aligned, `.num` utility (mono + tabular-nums).
- Row hover: `hover:bg-muted/40`.
- Set + collector-number columns: `<SetSymbol>` + mono number.
- Card name column: regular weight, no mono.

```tsx
<td className="num text-right">${row.usd.toFixed(2)}</td>
<td><SetSymbol setCode={row.setCode} rarity={row.rarity} /></td>
```

### Numeric stats with deltas

```tsx
<div>
  <p className="text-xs uppercase tracking-wide text-text-muted">
    Collection value
  </p>
  <p className="num text-2xl font-semibold">${value.toFixed(2)}</p>
  <ValueDelta value={delta30d} className="text-[11px]" />
</div>
```

### Empty / loading / error states

| State | Pattern |
|---|---|
| Empty | Bordered dashed box, `text-text-secondary`, one short sentence + optional CTA. Never jokey. |
| Loading | shadcn `<Skeleton>` matching the eventual layout. Never a generic spinner unless the action is genuinely indeterminate. |
| Error | `text-[var(--color-value-negative)]` headline + one-sentence explanation. Offer a retry when possible. |

---

## Microcopy voice

Terse, professional, no exclamations. Match the trading-desk tone.

| Action | Voice |
|---|---|
| Add | `Added 4× Sol Ring (CMR) → Long box 1` |
| Dispose | `Disposed: Sol Ring (CMR) · +$2.40 realized` |
| Restore | `Restored: Sol Ring (CMR)` |
| Delete | `Deleted` (no card name needed — irreversible action already confirmed) |
| Error (third-party) | `Couldn't reach Commander Spellbook. Bracket estimate may be conservative.` |
| Error (validation) | `Invalid payload: <field> must be a positive number.` |
| Snapshot saved | `Snapshot saved: $1,247.83 · Bracket 3` |

Never use:
- "Oops!" / "Yikes!" / emojis in toasts
- "Great!" / "Awesome!" / cheerleading
- Vague "Something went wrong" — always be specific

---

## Hard rules

1. **No hardcoded colors in components.** All color values come from
   `var(--color-*)` or the matching Tailwind utility. Audit your code: if you
   wrote `bg-red-500`, you owe a token.
2. **No inline `<img>` for card images without the `eslint-disable` comment
   and a deliberate reason.** Card images come from Scryfall's CDN and are
   already optimized; `next/image` adds latency for no benefit.
3. **Bracket badges always use `<BracketBadge>`.** Not inline `bg-amber-100`.
4. **Mana costs always use `<ManaCost>`.** Not raw `{W}{U}` text.
5. **Numerics in data contexts always use `.num` or `font-mono tabular-nums`.**
   Browser default proportional figures wreck column alignment.
6. **No emojis in production UI.** They render inconsistently across
   platforms and clash with the aesthetic. Use Lucide icons.

---

## Adding a token

1. Add the variable to both `:root` and `.dark` blocks in
   [`src/app/globals.css`](../src/app/globals.css).
2. Expose it under `@theme inline` if you want a Tailwind utility for it.
3. Add a row to the appropriate table in this document.
4. Add a swatch to the [`/style-guide`](../src/app/(app)/style-guide/page.tsx)
   page so it's visible during review.

---

## Adding a component

1. Build it under `src/components/` (or a subfolder if it's screen-scoped).
2. Read color from tokens only.
3. Add a sample to [`/style-guide`](../src/app/(app)/style-guide/page.tsx) under
   the appropriate section.
4. Add a row to the "Components" table above with a one-line purpose.

---

## When you find yourself wanting an exception

Don't. Either the token system needs a new entry (likely) or you're styling
something that should be a shared component. Open a small refactor before
sneaking in a one-off `text-amber-400`.
