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
- UI: Tailwind v4, shadcn/ui, TanStack Table/Query

## Conventions

- **Package manager:** pnpm
- **Schema changes:** edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`
- **Inventory model:** one DB row per physical card (no `quantity` on `inventory`)
- **Cron routes:** `/api/cron/*` skip proxy auth; require `CRON_SECRET` bearer token
- **Scryfall bulk sync:** `pnpm db:seed` / GitHub Action — not a Vercel cron (timeout)
- **Bracket combos:** live Commander Spellbook API — `combos` tables in schema are unused

## Before committing

Run `pnpm lint` and `pnpm build`. No automated test suite yet.
