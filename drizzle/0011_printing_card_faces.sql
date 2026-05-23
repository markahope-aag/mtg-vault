-- Per-printing card_faces, including each face's image_uris. Needed because
-- double-faced cards have image_uris: null on the printing — the front/back
-- art lives under card_faces[i].image_uris. Without this column, every DFC
-- rendered as a blank image.
ALTER TABLE "printings" ADD COLUMN "card_faces" jsonb;
