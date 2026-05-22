-- Widen cards.cmc: un-set cards (Gleemax) have CMC 1,000,000 which overflows
-- numeric(4,1). scale 1 is retained for half-mana costs ({1/2}).
ALTER TABLE "cards" ALTER COLUMN "cmc" TYPE numeric(12, 1);
