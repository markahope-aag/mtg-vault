-- Supabase database lint (lint=0009_extension_in_public_schema) flags
-- extensions installed in the public schema. pg_trgm was installed in
-- public by migration 0003 because that was the documented default at
-- the time. The recommended pattern is a dedicated `extensions`
-- schema, primarily so PostgREST anon access through public stays
-- limited to user tables.
--
-- Not a runtime vulnerability for THIS app — anon doesn't reach our
-- user tables (RLS-with-no-policies blocks PostgREST), and Drizzle
-- runs as the table owner. But it's the right hygiene + clears the
-- linter.
--
-- The unqualified `%` operator and `similarity()` function are used
-- in dynamic SQL across inventory/search builders, so the operators
-- need to be in search_path post-move. Three layers cover that:
--
--   1. ALTER ROLE ... SET search_path covers future sessions.
--   2. src/db/client.ts sets `connection.search_path` on every
--      Drizzle connection so warm Vercel functions pick it up
--      immediately without a process restart.
--   3. Anyone running scripts (db:seed, cron handlers) connects via
--      the same Drizzle client OR via DIRECT_URL — both use the
--      role-level default.

CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

ALTER ROLE postgres SET search_path TO "$user", public, extensions;
ALTER ROLE authenticated SET search_path TO "$user", public, extensions;
ALTER ROLE anon SET search_path TO "$user", public, extensions;
ALTER ROLE service_role SET search_path TO "$user", public, extensions;
