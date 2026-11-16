-- One buyer can now place a second order.
--
-- `@@unique([userId, status])` was meant to keep a person to a single live basket, but it also
-- made every other status unique per person: the first checkout flipped that cart to CONVERTED
-- and the second one hit the constraint, so an account could only ever complete one order.

-- DropIndex
DROP INDEX IF EXISTS "carts_userId_status_key";

-- Index
CREATE INDEX IF NOT EXISTS "carts_userId_status_idx" ON "carts" ("userId", "status");

-- Partial unique: one ACTIVE basket per account, unlimited converted history.
CREATE UNIQUE INDEX IF NOT EXISTS "carts_active_per_user_key" ON "carts" ("userId") WHERE "status" = 'ACTIVE';
