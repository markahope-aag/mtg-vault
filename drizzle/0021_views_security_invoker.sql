-- Supabase database lint (lint=0010_security_definer_view) flags
-- public.oracle_ownership and public.deck_commitments as SECURITY
-- DEFINER views. These views were created in migration 0007 without
-- an explicit SECURITY setting; in Supabase managed Postgres,
-- views created by the postgres role inherit DEFINER semantics by
-- default — meaning queries through them execute with the OWNER's
-- permissions + bypass the QUERYING user's RLS policies.
--
-- This is not a runtime vulnerability for THIS app because:
--   - All data access goes through Drizzle as the table owner
--     (DATABASE_URL connection), which bypasses RLS anyway.
--   - PostgREST / anon access is locked down via RLS-with-no-policies
--     on every user table (see migration 0002).
--
-- But the linter is correct that the views shouldn't be DEFINER by
-- default — if RLS policies are ever added to inventory/deck_cards,
-- the views would silently exempt themselves. Setting
-- security_invoker = on (Postgres 15+) makes the views explicitly
-- use the querying role's permissions, matching the principle of
-- least privilege.

ALTER VIEW public.oracle_ownership SET (security_invoker = on);
ALTER VIEW public.deck_commitments SET (security_invoker = on);
