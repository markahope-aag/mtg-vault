# MTG Vault — Build Spec

A personal Magic: The Gathering inventory and Commander deckbuilding tool. Desktop-first web app. Single user. Built on Next.js + Supabase + Drizzle, deployed to Vercel.

> **Status (May 2026):** v0 is **complete and in active use**. All phased deliverables shipped. See [README](./README.md) for dev setup and [USER-GUIDE](./USER-GUIDE.md) for usage.

---

## 1. Goals

### v0 scope (shipped)

1. **Inventory.** Know what cards you own, where they are, what you paid, what they're worth now.
2. **Deckbuilder.** Build and edit Commander decks against your inventory. Own / need diff per deck.
3. **Bracket engine.** Compute the official Commander Bracket (1–5) for any deck, with a "to drop a bracket, remove these cards" diff.
4. **Value.** Total collection value, per-deck value, value-over-time charts.

### Post-v0 additions (also shipped)

- CSV import with undo (ManaBox, Moxfield, Archidekt, **TCGPlayer**)
- Canonical **locations** list managed on the System page
- **Coach** pane — heuristic slot targets scaled to bracket
- **Strategy** pane — Claude AI deck analysis (`ANTHROPIC_API_KEY`)
- **Acquire** pane — cost-to-build rollup for cards you don't own
- Import **history** with batch undo
- Admin **bracket-flag** audit page (`/admin/bracket-flags`)
- Physical-card inventory model (one DB row per card, no quantity column)
- Disposal tracking (soft dispose / restore, cost-basis history)
- Availability views (`deck_commitments`, `oracle_ownership`) — a physical card can only be in one deck

### Still out of scope

Multi-user (deferred — `proxy.ts` allowlist works for the single-user case), non-Commander-format deckbuilding (legality badges exist on card pages, but the deckbuilder is Commander-only), local Spellbook combo DB sync.

---

## 2. Tech stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | TypeScript strict; auth via `src/proxy.ts` (Next.js 16 proxy convention) |
| Styling | Tailwind v4 + shadcn/ui | Design tokens in `src/app/globals.css`; see [STYLE_GUIDE](./docs/STYLE_GUIDE.md) |
| DB | Supabase Postgres | Hosted |
| ORM | Drizzle | Direct `DATABASE_URL` connection; bypasses RLS as owner |
| Auth | Supabase Auth (magic link) | Comma-separated `ALLOWED_EMAIL` allowlist |
| Tables | Custom (`inventory-table/index.tsx`) | Hand-rolled grouped/physical view with client-side state; no virtualization |
| Client state | `fetch` + `useState`/`useEffect` | Each pane owns its own fetches and error toasts; no global query cache |
| Forms | react-hook-form + Zod | API + dialog validation |
| Charts | Recharts | Dashboard + price history |
| AI | Anthropic SDK | Strategy tab only; optional |
| Cron | Vercel Cron + GitHub Actions | See §6 |
| Deploy | Vercel | Free tier; Postgres on Supabase |
| Icons | Lucide | |

**Why Supabase Postgres:** JSON support for Scryfall shapes (prices, `image_uris`, `card_faces`).

---

## 3. Local setup

```powershell
# Prerequisites: Node 20+, pnpm, git
node --version
pnpm --version

git clone <repo>
cd magic-app
pnpm install

# Create .env.local — see §4
pnpm db:migrate
pnpm dev
```

**PowerShell notes:**
- `&&` works in PS 7+; on PS 5.1 use `;` or run commands separately.
- Session env: `$env:VARNAME = "value"`. Persistent: edit `.env.local`.

**First-time card data:** Run `pnpm db:seed` locally or trigger the GitHub Action. Expect 30–60 minutes for the full Scryfall bulk sync.

---

## 4. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Auth (not used for data queries) |
| `DATABASE_URL` | Yes | Drizzle Postgres connection |
| `DIRECT_URL` | Recommended | Direct connection for migrations (`drizzle.config.ts` prefers this) |
| `ALLOWED_EMAIL` | Yes | Comma-separated allowlist, e.g. `you@example.com,partner@example.com` |
| `CRON_SECRET` | Yes (prod) | Bearer token for cron routes |
| `ANTHROPIC_API_KEY` | Optional | Strategy tab AI analysis |

`SUPABASE_SERVICE_ROLE_KEY` is **not used** — all DB access goes through Drizzle with `DATABASE_URL`.

---

## 5. Project structure (current)

```
magic-app/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx              # Auth-gated shell + nav
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── decks/page.tsx
│   │   │   ├── decks/[id]/page.tsx     # Deckbuilder shell
│   │   │   ├── cards/[oracle_id]/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   ├── import/history/page.tsx
│   │   │   ├── system/page.tsx
│   │   │   ├── help/page.tsx
│   │   │   ├── admin/bracket-flags/page.tsx
│   │   │   └── style-guide/page.tsx
│   │   ├── api/                        # See README for route list
│   │   └── auth/callback/route.ts
│   ├── components/
│   │   ├── card-search/                # ⌘K palette
│   │   ├── deckbuilder/                # Multi-pane builder
│   │   ├── inventory-table/
│   │   └── ui/                         # shadcn primitives
│   ├── db/
│   │   ├── schema.ts                   # Source of truth
│   │   ├── client.ts
│   │   └── queries/
│   ├── lib/
│   │   ├── scryfall.ts
│   │   ├── spellbook.ts                # Live Commander Spellbook API
│   │   ├── bracket-engine.ts
│   │   ├── bracket-flags.ts
│   │   ├── game-changers.ts
│   │   ├── ai/strategy.ts
│   │   ├── importers/
│   │   └── supabase/
│   └── proxy.ts                        # Auth + allowlist (was middleware.ts in Next 15)
├── drizzle/                            # 16 migrations
├── scripts/sync-scryfall.ts            # Full bulk sync (also `pnpm db:seed`)
├── .github/workflows/weekly-card-sync.yml
├── vercel.json
└── .env.local
```

---

## 6. Database schema

**Source of truth:** `src/db/schema.ts`. Do not copy stale snippets from older spec revisions — run `pnpm db:generate` after edits.

### Reference layer (synced from Scryfall)

| Table | Purpose |
|---|---|
| `cards` | Oracle-level card data + bracket flags |
| `printings` | Individual printings, prices, images, `card_faces` for DFCs |
| `price_history` | Daily price snapshots per printing |
| `combos` / `combo_pieces` | **Schema only — not populated.** Combo detection uses live Spellbook API. |
| `sync_state` | Key/value sync metadata |

Notable schema choices:
- `cmc` is `numeric(12,1)` (Gleemax overflow fix)
- Bracket flags on `cards`: `is_game_changer`, `is_extra_turn`, `is_mass_land_denial`, `is_tutor`

### User layer

| Table | Purpose |
|---|---|
| `inventory` | **One row per physical card** — no `quantity` column |
| `decks` | Deck metadata + cached AI analysis JSON |
| `deck_cards` | Cards in deck (`category`: main / maybeboard / considering). Commander stored on `decks`, not here. |
| `deck_snapshots` | Point-in-time value + bracket |
| `collection_snapshots` | Daily whole-collection value |
| `import_batches` | CSV import audit trail |
| `locations` | Canonical storage location names |

### Views

- `deck_commitments` — which inventory rows are assigned to which deck
- `oracle_ownership` — uncommitted copy counts per oracle id

### RLS

Migration `0002_enable_rls.sql` enables RLS with **no policies** on core tables, blocking anon/authenticated PostgREST access. Drizzle uses the Postgres owner role and bypasses RLS. The `locations` table was missed in 0002 and was retroactively enabled in `0013_locations_rls_and_drop_combos.sql`; `trades` (added in `0015_trades.sql`) was enabled at create time.

---

## 7. Data sync jobs

### Architecture

The Scryfall **Default Cards** bulk file (~500MB) cannot reliably stream + upsert within a Vercel serverless timeout. Sync is split:

| Job | Runner | Schedule | Implementation |
|---|---|---|---|
| Full Scryfall sync | **GitHub Action** | Sundays 08:00 UTC | `.github/workflows/weekly-card-sync.yml` → `pnpm db:seed` |
| Daily collection snapshot | Vercel cron | 06:00 UTC | `/api/cron/daily-snapshot` |
| Game changers | Vercel cron | 06:30 UTC | `/api/cron/game-changers-sync` |
| Bracket flags (extra turn, MLD, tutors) | Vercel cron | 08:00 UTC | `/api/cron/refresh-bracket-flags` |

All cron routes check `Authorization: Bearer $CRON_SECRET` via `src/lib/cron-auth.ts`. The proxy skips auth for `/api/cron/*`.

### Scryfall sync (`scripts/sync-scryfall.ts`)

- Downloads Default Cards bulk metadata from `https://api.scryfall.com/bulk-data`
- Stream-parses with `stream-json` (never loads 500MB into memory)
- Upserts `cards`, `printings`, `price_history` in chunks
- Runs tutor + game-changer flag passes
- MLD list: `src/lib/curated/mld.ts`
- Tutors: Scryfall `is:tutor` search during sync

### Game changers (`src/lib/game-changers.ts`)

Scryfall `is:gamechanger` search; resets and re-flags `cards.is_game_changer`.

### Commander Spellbook (live API, not bulk sync)

**Original spec:** nightly bulk sync of `variants.json` into `combos` / `combo_pieces`.

**As built:** `src/lib/spellbook.ts` calls `backend.commanderspellbook.com/estimate-bracket` at bracket-calculation time. 8s timeout, 1h in-memory cache per serverless instance. `bracket-engine.ts` degrades gracefully when Spellbook is unavailable.

The local combo tables remain in schema but are unused. Either implement bulk sync later or drop the tables.

### `vercel.json` (current)

```json
{
  "crons": [
    { "path": "/api/cron/daily-snapshot", "schedule": "0 6 * * *" },
    { "path": "/api/cron/game-changers-sync", "schedule": "30 6 * * *" },
    { "path": "/api/cron/refresh-bracket-flags", "schedule": "0 8 * * *" }
  ]
}
```

---

## 8. CSV importer

**Formats:** ManaBox, Moxfield, Archidekt, TCGPlayer (`src/lib/importers/detect.ts`).

**Flow:** Upload → configure (location + mode) → resolve unmatched → confirm → commit.

**Matching priority:**
1. Scryfall ID (ManaBox)
2. Set code + collector number
3. Name + set code (may need manual disambiguation)
4. Name only (chooser)

**Physical-card expansion:** Import rows with `quantity: N` expand into N inventory rows on commit.

**Modes:**
- **Append** — add rows to inventory
- **Replace location** — dispose existing cards at the target location, then import (undo restores disposed cards)

**Undo:** `/import/history` → undo batch removes imported rows and restores disposed cards from that batch.

---

## 9. Deckbuilder UI

Three-pane layout at ≥1024px (`src/components/deckbuilder/shell.tsx`):

| Pane | Purpose |
|---|---|
| Left | Card search (full DB), filters, owned-only toggle |
| Middle | Decklist grouped by type, ownership indicators |
| Right | Detail / Coach / Strategy / Acquire tabs |

**Bracket panel** — overlay via ⌘B showing calculated bracket, reasons, removal diffs.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘K / Ctrl+K | Global card search |
| / | Focus deckbuilder search |
| Enter | Add highlighted card |
| Backspace | Remove selected decklist row |
| ⌘/ | Toggle owned-only filter |
| ⌘B | Bracket panel |
| ⌘S | Save deck snapshot |
| Esc | Clear selected card |

### Availability

A physical card can only be in one deck. `src/db/queries/availability.ts` uses DB views to compute committed vs available copies. Coach and own/need badges respect this.

---

## 10. Bracket engine

**Implementation:** `src/lib/bracket-engine.ts` + `POST /api/decks/[id]/bracket`

Takes deck oracle IDs, fetches local flag data, calls Spellbook for combo detection, applies WotC bracket rules, returns:

- `bracket` (1–5), `confidence` (calculated / declared / conservative)
- Structured `reasons` by category
- `toReachBracket` removal diffs with EDHREC/price heuristics
- `declaredAsCedh` path for Bracket 5 (intent-based; user confirms)

**UI caveat:** Bracket 5 is intent-based. The engine surfaces "looks like cEDH" signals but Bracket 5 requires user declaration.

**MLD curated list:** `src/lib/curated/mld.ts`

---

## 11. Value tracking

| View | Source |
|---|---|
| Collection total | Finish-aware join of `inventory` × `printings` (foil/etched columns) |
| Per-deck value | Same join scoped to `deck_cards` |
| Value over time | `collection_snapshots` (daily cron) + `deck_snapshots` (manual ⌘S or bracket route) |
| Dashboard | `src/app/(app)/dashboard/page.tsx` + Recharts |

**Note:** Deck list tiles use base `printings.usd`, not finish-aware pricing — minor inconsistency vs inventory.

---

## 12. Auth (single-user)

**Proxy:** `src/proxy.ts` (Next.js 16 — replaces `middleware.ts`).

- Magic-link login at `/login`
- PKCE callback at `/auth/callback`
- Comma-separated `ALLOWED_EMAIL` allowlist
- Non-allowlisted users signed out → `/login?error=not_allowed`
- App layout double-checks user server-side
- No `user_id` columns — single writer assumed

Cron routes bypass user auth; protected by `CRON_SECRET`.

API route handlers do not re-check auth individually — they rely on the proxy. Acceptable for single-user; add per-handler checks if opening up.

---

## 13. Phased build order (complete)

All phases from the original plan shipped. Approximate original estimates vs reality:

| Phase | Status | Output |
|---|---|---|
| P1: Foundation | ✅ | Drizzle, schema, auth, proxy |
| P2: Scryfall sync | ✅ | Bulk sync via script + GH Action |
| P3: Card search | ✅ | ⌘K palette, local + Scryfall fallback search |
| P4: Inventory | ✅ | Physical-card model, grouped/physical views, disposal |
| P5: CSV importer | ✅ | Four formats, undo, replace-location mode |
| P6: Decks CRUD | ✅ | List, create, commander assignment |
| P7: Deckbuilder UI | ✅ | Multi-pane + Coach/Strategy/Acquire |
| P8: Game Changers + flags | ✅ | Cron jobs; Spellbook bulk sync deferred |
| P9: Bracket engine | ✅ | Engine + panel + snapshots |
| P10: Value over time | ✅ | Collection snapshots, dashboard charts |

Post-v0 work (AI strategy, locations, import history, admin tools) was added without a formal phase plan.

---

## 14. Known gaps and tech debt

| Item | Severity | Notes |
|---|---|---|
| Automated tests | Partial | Vitest: bracket logic, importers, slots, sql, calculateBracket wiring; API/UI still untested |
| `combos` tables unused | Low | Live Spellbook API replaced bulk sync plan |
| `locations` missing RLS | Low | Inconsistent with other tables |
| Import commit not transactional | Medium | Partial failure can leave inconsistent batch state |
| Partner validation heuristic | Low | Regex `Partner` only; Background/Friends Forever deferred |
| No color-identity enforcement on add | Low | Banned cards warn; off-color cards allowed |
| Spellbook cache per-instance | Low | Cold starts re-hit external API |

---

## 15. v1 — shipped

- PWA shell — `manifest.webmanifest`, service worker with offline-safe cache for shell + Scryfall images + `/api/*`.
- Single-card vision scanner — camera capture on Inventory → Claude Haiku identifies → hands off to AddCardsDialog.
- Synergy view — co-occurrence-in-your-decks signal rendered on card detail pages (chosen over scraping EDHrec).
- Non-Commander format legality — `cards.legalities` jsonb populated by sync; badges on card detail.
- Trade tracker — `/trades` history + log/detail; `trades` table + `inventory.trade_id` tags both directions.

### Not started

- Multi-user (`user_id` columns + RLS policies) — deferred indefinitely; allowlist works for the single-user case.
- Non-Commander-format deckbuilding (legality is surfaced, but the deckbuilder still assumes Commander rules).
- Local Spellbook combo DB sync — the dead tables were dropped in `0013`; bring it back only if Spellbook adds a usable diff feed.

---

## 16. Deliberate exclusions (unchanged)

- **Card images:** Scryfall CDN directly — do not proxy or self-host
- **Multi-currency:** USD only (EUR column exists on printings)
- **Sealed product tracking:** use `notes` if needed
- **Tagging beyond location:** deferred

---

## 17. Agent / contributor notes

- Read [AGENTS.md](./AGENTS.md) — this project uses **Next.js 16** with breaking changes vs training data; check `node_modules/next/dist/docs/` before writing Next.js code.
- Match existing conventions in surrounding code; schema changes need `pnpm db:generate` + migration.
- Design work follows [docs/STYLE_GUIDE.md](./docs/STYLE_GUIDE.md).
- User-facing copy changes should update both [USER-GUIDE.md](./USER-GUIDE.md) and `src/lib/help-content.ts`.
