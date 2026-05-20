-- Track CSV import batches so we can show history, deduplicate uploads,
-- and undo a batch by deleting all rows it created.

CREATE TABLE "public"."import_batches" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "filename"          text NOT NULL,
  "file_hash"         text NOT NULL,
  "format"            text NOT NULL,
  "total_rows"        integer NOT NULL,
  "imported_rows"     integer NOT NULL,
  "unmatched_rows"    integer NOT NULL,
  "skipped_rows"      integer NOT NULL,
  "default_location"  text,
  "mode"              text NOT NULL,
  "created_at"        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "import_batches_hash_idx" ON "public"."import_batches" ("file_hash");

ALTER TABLE "public"."import_batches" ENABLE ROW LEVEL SECURITY;

-- Per-row backreference so we can list/undo what an import created.
ALTER TABLE "public"."inventory"
  ADD COLUMN "import_batch_id" uuid REFERENCES "public"."import_batches"("id") ON DELETE SET NULL;

CREATE INDEX "inventory_import_batch_id_idx" ON "public"."inventory" ("import_batch_id");
