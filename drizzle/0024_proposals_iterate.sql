-- Phase 3: Rogue iterate (fork-a-proposal).
--
-- Adds a self-referential parent link to deck_proposals so iterated
-- proposals point back at the build they were forked from. ON DELETE
-- SET NULL so deleting a parent doesn't cascade and wipe the child's
-- iteration history — the child's own decklist is still the user's
-- saved work.
--
-- iterate_instruction is the modification directive the user typed
-- ("→ Bracket 2", "swap wincon", "stay in my collection", …). We
-- store it on the CHILD row so the lineage view can show the chain
-- of "what changed at each step."

ALTER TABLE "deck_proposals"
  ADD COLUMN "parent_proposal_id" uuid
    REFERENCES "deck_proposals"("id") ON DELETE SET NULL,
  ADD COLUMN "iterate_instruction" text;

CREATE INDEX "deck_proposals_parent_idx"
  ON "deck_proposals" ("parent_proposal_id")
  WHERE "parent_proposal_id" IS NOT NULL;
