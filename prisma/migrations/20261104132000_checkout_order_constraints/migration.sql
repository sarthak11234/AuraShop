-- Final schema alignment after the checkout migrations:
--  * legacy order numbers must not be nullable (backfill before enforcing),
--  * the order owner FK must match the schema's ON DELETE SET NULL rule,
--  * indexes declared in the Prisma schema must exist in the database.

UPDATE "Order"
  SET "orderNumber" = 'VEXO-LEGACY-' || UPPER(SUBSTR(MD5("id"), 1, 12))
  WHERE "orderNumber" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX IF NOT EXISTS "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");
CREATE INDEX IF NOT EXISTS "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
