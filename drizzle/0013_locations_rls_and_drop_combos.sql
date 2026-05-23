-- 1) Match the RLS posture of every other table. 0012_locations forgot this,
--    so the anon/authenticated roles can currently read the locations table
--    via PostgREST. RLS with no policies blocks them, matching the rest of
--    the schema. App access is via the postgres-js driver as table owner,
--    which bypasses RLS.
ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;

-- 2) Drop the combos / combo_pieces tables. They were created in 0000 in
--    anticipation of a Spellbook -> DB sync that never shipped. The
--    bracket-engine reads Spellbook live via the API (src/lib/spellbook.ts),
--    not the DB. No code path SELECTs from these tables — removing the
--    schema declarations forces that fact to stay true.
DROP TABLE IF EXISTS "public"."combo_pieces";
DROP TABLE IF EXISTS "public"."combos";
