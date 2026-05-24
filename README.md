# MTG Vault

Personal Magic: The Gathering inventory and Commander deckbuilding tool.

Desktop-first web app. Single user. Built on Next.js 16 + Supabase + Drizzle, deployed to Vercel.

## What it does

- **Inventory** — track every physical card you own: location, condition, cost basis, current market value, disposal history
- **Deckbuilder** — build Commander decks against your inventory with own/need diffs and availability tracking
- **AI deck generator** — Standard or Rogue generators with inventory scope (unassigned / all owned / disregard); Rogue runs 4-pass adversarial critique
- **Bracket engine** — compute the official Commander Bracket (1–5) with structured reasons and "remove these to drop a bracket" diffs
- **Value tracking** — collection and per-deck value, daily snapshots, value-over-time charts
- **CSV import** — ManaBox, Moxfield, Archidekt, and TCGPlayer with preview, resolve, and undo
- **Vision scanner** — camera capture on Inventory + Claude vision card identification
- **Trades & ledger** — unified transactions (purchase/sale/trade) with proportional cost-basis allocation and realized P&L
- **Market intelligence** — appreciated/movers/underwater views, want list, multi-source bargain sweeps (eBay Browse API + DB-defined Shopify LGS scrapers)
- **AI strategy** — Claude-powered deck analysis (archetype, gameplan, inventory improvements, acquire list)
- **Coach** — heuristic slot checker (ramp, removal, draw, etc.) scaled to target bracket
- **PWA** — installable on phone/desktop with offline-readable inventory/decks

## Documentation

| Doc | Audience | Purpose |
|---|---|---|
| [USER-GUIDE.md](./USER-GUIDE.md) | You (the user) | How to use every screen |
| [mtg-vault-v0-spec.md](./mtg-vault-v0-spec.md) | Developers / agents | Architecture, schema, sync jobs, auth |
| [docs/STYLE_GUIDE.md](./docs/STYLE_GUIDE.md) | Contributors | Design tokens, components, voice |
| [/help](https://localhost/help) | In-app | Same content as the user guide |

## Status

**v0 complete; v1 shipped and in active use.** Core v0 (inventory, deckbuilder, bracket, value tracking) plus v1 phases: PWA, vision scanner, non-Commander legality badges, Rogue deck generator (3 phases), transactions ledger (Phase A), market intelligence (Phases B–C, including scraper adapters). See [mtg-vault-v0-spec.md](./mtg-vault-v0-spec.md) §15 for the phase log.

## Quick start

**Prerequisites:** Node 20+, pnpm, a Supabase project with Postgres.

```powershell
pnpm install
# Create .env.local with the variables listed below
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated requests redirect to `/login` (Supabase magic link).

### Environment variables

Create `.env.local` (never commit):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (auth only) |
| `DATABASE_URL` | Yes | Postgres connection for Drizzle (pooler URL is fine) |
| `DIRECT_URL` | Recommended | Direct connection for `drizzle-kit migrate` |
| `ALLOWED_EMAIL` | Yes | Comma-separated email allowlist |
| `CRON_SECRET` | Yes (prod) | Bearer token for `/api/cron/*` routes |
| `ANTHROPIC_API_KEY` | Optional | Enables Strategy tab, deck generator, and vision scanner |
| `EBAY_APP_ID` | Optional | eBay Browse API adapter (Market → Bargains) |
| `EBAY_CERT_ID` | Optional | eBay developer cert (paired with `EBAY_APP_ID`) |
| `EBAY_OAUTH_TOKEN` | Optional | eBay client-credentials token; adapter is disabled if any of the three are missing |
| `BRIGHTDATA_API_TOKEN` | Optional | Bright Data Web Unlocker for scraper sources that need anti-bot bypass |

The app uses Drizzle over a direct Postgres connection — not the Supabase JS client for data access. RLS is enabled with no policies so PostgREST/anon cannot read user tables; Drizzle connects as the table owner and bypasses RLS.

### Database

```powershell
pnpm db:generate   # after schema changes in src/db/schema.ts
pnpm db:migrate    # apply migrations from drizzle/
pnpm db:seed       # full Scryfall bulk sync (long-running; ~500MB download)
```

Migrations live in `drizzle/` (21 applied). Schema source of truth: `src/db/schema.ts`.

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate Drizzle migration |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Scryfall bulk sync (`scripts/sync-scryfall.ts`) |

## Data sync

Sync is split across two runners because the Scryfall bulk file (~500MB) cannot reliably finish inside a Vercel serverless timeout.

| Job | Runner | Schedule | What it does |
|---|---|---|---|
| Full Scryfall sync | GitHub Action (`.github/workflows/weekly-card-sync.yml`) | Sundays 08:00 UTC | Cards, printings, prices, tutor flags |
| Daily collection snapshot | Vercel cron `/api/cron/daily-snapshot` | 06:00 UTC daily | Upserts today's collection value |
| Game changers sync | Vercel cron `/api/cron/game-changers-sync` | 06:30 UTC daily | Refreshes `is_game_changer` flags |
| Bracket flags refresh | Vercel cron `/api/cron/refresh-bracket-flags` | 08:00 UTC daily | Extra turns, MLD, tutor flags |

Combo detection for bracket calculation uses the **live Commander Spellbook API** (`src/lib/spellbook.ts`), not a local combo database. The `combos` / `combo_pieces` tables exist in schema but are not populated.

## Project layout

```
src/
├── app/
│   ├── (auth)/login/          # Magic-link login
│   ├── (app)/                 # Auth-gated pages (dashboard, inventory, decks, …)
│   ├── api/                   # REST handlers (inventory, decks, import, cron, …)
│   └── auth/callback/         # Supabase PKCE callback
├── components/                # UI (deckbuilder, inventory-table, card-search, ui/)
├── db/
│   ├── schema.ts              # Drizzle schema
│   ├── client.ts              # Lazy Postgres client
│   └── queries/               # Shared query helpers
├── lib/
│   ├── bracket-engine.ts      # Bracket calculation
│   ├── spellbook.ts           # Commander Spellbook client
│   ├── scryfall.ts            # Bulk sync + search helpers
│   ├── importers/             # CSV parsers (ManaBox, Moxfield, Archidekt, TCGPlayer)
│   ├── ai/strategy.ts         # Claude deck analysis
│   ├── rogue/                 # Deck generator (standard + rogue) + reconcile engine
│   ├── ledger/                # Transactions, cost-basis allocation, P&L
│   ├── market/                # Source interface, eBay adapter, scraper adapters, bargains
│   └── supabase/              # Auth clients
└── proxy.ts                   # Auth + email allowlist (Next.js 16 proxy convention)
```

## Auth

Single-user magic-link auth with an email allowlist enforced in `src/proxy.ts`. `ALLOWED_EMAIL` accepts a comma-separated list. Cron routes skip user auth and require `Authorization: Bearer $CRON_SECRET`.

There are no `user_id` columns — the app assumes one writer. Multi-user would require schema and RLS policy work.

## Testing

Vitest unit tests across 31 files / 359 tests. Coverage spans:

- **Auth & proxy** — allowlist, cron bearer auth, Next 16 `proxy.ts` matcher behavior.
- **Bracket engine** — pure slot logic, full bracket calculation, flag refresh, Game Changer + Spellbook integration.
- **Decks** — queries, schemas, slot classification, deck validation.
- **Inventory** — queries (filters, sort, pagination), Zod schemas, table grouping/selection logic.
- **Importers** — format detection, ManaBox/Moxfield/Archidekt/TCGPlayer parsers, printing resolver.
- **Ledger** — cost-basis allocation math (purchases, sales, trades, rounding-drift).
- **Market** — bargain detection thresholds, source registry, scraper denylist.
- **Rogue generator** — proposal validation, inventory reconciliation.
- **API routes** — round-trip happy-path + 400/404/500 surfaces via mocked DB; auth-gate contract test enumerates every `route.ts` and asserts unauthenticated callers 307 to `/login`.
- **Components** — InventoryTable + a handful of rendering smoke tests.
- **Utilities** — `sql` array interpolation, `cn`, Scryfall row transform.

```powershell
pnpm test           # run once
pnpm test:watch     # watch mode
pnpm test:coverage  # with coverage report + thresholds
```

Run `pnpm lint`, `pnpm test`, and `pnpm build` before committing.

## Spec history

The original phased build plan and domain notes live in [`mtg-vault-v0-spec.md`](./mtg-vault-v0-spec.md). That document tracks what was planned, what shipped, and what diverged (physical-card inventory model, live Spellbook API, GitHub Action for Scryfall, etc.).
