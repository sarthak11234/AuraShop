-- The Order totals breakdown (subtotal, discount, shipping, tax) is part of the
-- current Prisma schema, but earlier environments picked it up via `db push`.
-- Fresh databases built from migration history were missing these columns,
-- causing every checkout lookup to fail with P2022. Add them idempotently so
-- both fresh and already-upgraded databases converge on the same schema.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax" DECIMAL(10,2) NOT NULL DEFAULT 0;
