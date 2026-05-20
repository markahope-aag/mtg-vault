-- Views that power the deckbuilder's "owned / available" badges without
-- recomputing aggregates on every render. Views (not materialized) so they
-- stay live as inventory and deck_cards change.

CREATE OR REPLACE VIEW deck_commitments AS
SELECT
  p.oracle_id,
  dc.deck_id,
  SUM(dc.quantity)::int AS committed_qty
FROM deck_cards dc
JOIN printings p ON p.id = dc.printing_id
GROUP BY p.oracle_id, dc.deck_id;

CREATE OR REPLACE VIEW oracle_ownership AS
SELECT
  p.oracle_id,
  COUNT(*) FILTER (WHERE i.disposed_at IS NULL)::int AS owned_count
FROM inventory i
JOIN printings p ON p.id = i.printing_id
GROUP BY p.oracle_id;
