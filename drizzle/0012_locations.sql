-- Canonical list of physical storage locations for inventory cards. Add cards
-- and Edit row dialogs pick from this; the System page manages it.
CREATE TABLE "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Seed the three defaults the user asked for, plus every distinct location
-- already in use in inventory (so historical data keeps showing up in the
-- dropdown).
INSERT INTO "locations" ("name") VALUES
  ('Trade Binder'),
  ('Kabinka Box'),
  ('Card Box')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "locations" ("name")
SELECT DISTINCT location FROM inventory
WHERE location IS NOT NULL AND location <> ''
ON CONFLICT ("name") DO NOTHING;
