-- Retire the standalone trades table now that transactions covers
-- everything it did + more. There were never any rows (verified before
-- the migration), so this is purely a schema cleanup. The Phase B/C-era
-- /trades UI has been replaced with the transactions-based ledger.

DROP INDEX IF EXISTS "inventory_trade_id_idx";
ALTER TABLE "inventory" DROP COLUMN IF EXISTS "trade_id";
DROP TABLE IF EXISTS "trades";
