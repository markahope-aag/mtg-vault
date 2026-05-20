-- Rebuild inventory under the one-row-per-physical-card model.
-- The previous table is dropped because (a) it has no production data and
-- (b) the quantity column is going away in favor of N rows per stack.

DROP TABLE IF EXISTS "public"."inventory" CASCADE;

CREATE TABLE "public"."inventory" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "printing_id"      uuid NOT NULL REFERENCES "public"."printings"("id"),
  "foil"             boolean      NOT NULL DEFAULT false,
  "etched"           boolean      NOT NULL DEFAULT false,
  "condition"        text         NOT NULL DEFAULT 'NM',
  "language"         text         NOT NULL DEFAULT 'en',
  "location"         text,
  "physical_id"      text,
  "acquired_price"   numeric(10,2),
  "acquired_at"      timestamp,
  "purchased_from"   text,
  "grading_company"  text,
  "grade"            text,
  "notes"            text,
  "disposed_to"      text,
  "disposed_price"   numeric(10,2),
  "disposed_at"      timestamp,
  "created_at"       timestamp    NOT NULL DEFAULT now(),
  "updated_at"       timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX "inventory_printing_id_idx" ON "public"."inventory" ("printing_id");
CREATE INDEX "inventory_disposed_at_idx" ON "public"."inventory" ("disposed_at");
CREATE INDEX "inventory_location_idx"    ON "public"."inventory" ("location");

-- Re-enable RLS on the recreated table.
ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;
