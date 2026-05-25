<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MTG Vault — agent notes

Personal Commander inventory and deckbuilder. Single-user app; v0 is complete and in active use.

## Documentation (read before large changes)

| Doc | Purpose |
|---|---|
| [README.md](./README.md) | Dev setup, env vars, sync architecture |
| [mtg-vault-v0-spec.md](./mtg-vault-v0-spec.md) | Schema, auth, crons, known gaps |
| [USER-GUIDE.md](./USER-GUIDE.md) | User-facing feature reference |
| [docs/STYLE_GUIDE.md](./docs/STYLE_GUIDE.md) | Design tokens and UI conventions |

When changing user-facing copy, update **both** `USER-GUIDE.md` and `src/lib/help-content.ts`.

## Stack

- Next.js **16** App Router, React 19, TypeScript strict
- Auth: Supabase magic link + `src/proxy.ts` email allowlist (`ALLOWED_EMAIL`, comma-separated)
- Data: Drizzle ORM over `DATABASE_URL` (not Supabase client for queries)
- UI: Tailwind v4, shadcn/ui, custom table + raw `fetch`/`useState` per pane

## Query layer convention

Two homes for SQL-touching code; the split is by **ownership**, not technology:

| Location | When to use | Examples |
|---|---|---|
| `src/db/queries/*.ts` | **Cross-cutting primitives** consumed by 2+ features and/or cron jobs. No single feature owns the result shape. | `availability.ts` (used by deckbuilder + coach), `collection-value.ts` (used by daily snapshot cron + dashboard) |
| `src/lib/<feature>/queries.ts` | **Feature-scoped queries** whose return shape is tailored to one feature page or API. Co-located with that feature's `types.ts` / `schemas.ts`. | `lib/inventory/queries.ts` (inventory list + filters), `lib/decks/queries.ts` (deck list + detail), `lib/dashboard/queries.ts` (top cards, insights, snapshots) |

Rule of thumb: if the same query starts getting imported by a second feature, **move it to `src/db/queries/`** rather than re-exporting from one feature into another. Keep `db/queries/` small and stable — most new code belongs in a feature folder.

Both layers use Drizzle (`db.execute(sql\`…\`)` or the typed builder) over the `DATABASE_URL` connection and bypass RLS as table owner. Neither uses the Supabase JS client.

## Conventions

- **Package manager:** pnpm
- **Schema changes:** edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`
- **Inventory model:** one DB row per physical card (no `quantity` on `inventory`)
- **Cron routes:** `/api/cron/*` skip proxy auth; require `CRON_SECRET` bearer token
- **Scryfall bulk sync:** `pnpm db:seed` / GitHub Action — not a Vercel cron (timeout)
- **Bracket combos:** live Commander Spellbook API — the `combos` / `combo_pieces` tables were dropped in migration `0013`
- **API errors:** use `serverError(tag, err, message)` from `src/lib/api-errors.ts`. Log full err server-side, return a generic message to the client. Never `err.message` in 500 responses.

## Auth model

The auth boundary lives **entirely** in `src/proxy.ts`. Every request matching the matcher passes through `getUser()` + email-allowlist check before reaching a route handler. There is no per-handler `auth.getUser()` call **except** for admin entry points (see below) — adding it everywhere would multiply Supabase round-trips across 46+ routes for no security gain in a single-user allowlist app.

**Admin elevation.** Every `/api/admin/*` handler calls `requireAdmin()` first (`spellbook-test`, `bracket-flag-audit`, `market-sources` CRUD + test). `/(app)/admin/*` pages and `refreshBracketFlagsAction` use `requireAdminUser()`. Contract tests in `src/app/api/admin/admin-gate.test.ts` assert 401/403/allow without mocking the gate. Admin list is parsed from `ADMIN_EMAIL` (comma-separated), falling back to `ALLOWED_EMAIL` when unset.

**Session inside a handler.** Non-admin routes generally should NOT call `auth.getUser()` per-handler — the proxy already gates them and adding it everywhere would multiply Supabase round-trips for no security gain (see PR #5's auth-model contract). If a future route legitimately needs the user identity inside the handler (audit logging, echoing email back, per-user isolation), copy the small `requireAdmin`-style pattern locally rather than introducing a shared helper — keeping the friction high stops it from sprawling.

This means **the proxy matcher is load-bearing**. Two contract tests pin it:

- `src/proxy.test.ts` — unit tests for the proxy's branches (allowlist, signout, login redirect, cron passthrough).
- `src/app/api/auth-gate.test.ts` — enumerates every `route.ts` under `src/app/api/` at test time and asserts each non-cron route 307s to `/login` for unauthenticated callers. Also asserts `/manifest.webmanifest` and `/sw.js` bypass (PWA contract).

If you add a `config.matcher` exclusion to fix a static-asset issue, run `pnpm test src/app/api/auth-gate.test.ts` — it'll fail loudly if the exclusion widens too far and catches a real route.

`shouldBypassAuth` in `src/lib/auth/allowlist.ts` is the second knob: only `/api/cron/*`, `/manifest.webmanifest`, and `/sw.js` should ever be bypassed. New entries here need a matching test case.

## Before committing

Run `pnpm lint`, `pnpm test`, and `pnpm build`.
