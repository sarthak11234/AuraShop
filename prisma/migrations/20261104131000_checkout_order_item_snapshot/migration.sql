-- Align the OrderItem snapshot fields and identifier with the current schema.
-- Earlier databases picked these up through `db push`; fresh databases built
-- from the initial migration only had id/orderId/productId/quantity/price,
-- which broke order creation at checkout.

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "productTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "productSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "productImage" TEXT,
  ADD COLUMN IF NOT EXISTS "size" TEXT,
  ADD COLUMN IF NOT EXISTS "lineTotal" DECIMAL(10,2);

-- Backfill any pre-existing rows before enforcing the required columns.
UPDATE "OrderItem"
  SET "productTitle" = 'Unknown product'
  WHERE "productTitle" IS NULL OR "productTitle" = '';

UPDATE "OrderItem"
  SET "productSlug" = 'unknown-product'
  WHERE "productSlug" IS NULL OR "productSlug" = '';

UPDATE "OrderItem"
  SET "lineTotal" = "price" * "quantity"
  WHERE "lineTotal" IS NULL;

ALTER TABLE "OrderItem"
  ALTER COLUMN "productTitle" SET NOT NULL,
  ALTER COLUMN "productSlug" SET NOT NULL,
  ALTER COLUMN "lineTotal" SET NOT NULL;

-- The initial migration created OrderItem.id as TEXT, while the current
-- schema uses an autoincrementing integer. Convert only when necessary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OrderItem'
      AND column_name = 'id'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "OrderItem"
      ALTER COLUMN "id" TYPE INTEGER USING ("id"::integer);
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS "OrderItem_id_seq";
ALTER TABLE "OrderItem" ALTER COLUMN "id" SET DEFAULT nextval('"OrderItem_id_seq"');
SELECT setval(
  '"OrderItem_id_seq"',
  COALESCE((SELECT MAX("id") FROM "OrderItem"), 0) + 1,
  false
);
