-- Phase 12.1 customer accounts: additive-only schema changes.
-- Existing users, addresses, orders, payments and catalogue records are untouched.

-- Extend order lifecycle with the packed checkpoint and failed delivery.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FAILED_DELIVERY';

CREATE TYPE "TrackingEventSource" AS ENUM ('SYSTEM', 'ADMIN', 'CUSTOMER', 'CARRIER');

-- Customer profile.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Saved-address defaults and landmark. Order snapshot addresses keep these
-- columns at their false/default values and are never treated as saved addresses.
ALTER TABLE "Address"
  ADD COLUMN IF NOT EXISTS "landmark" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Address_userId_orderId_idx" ON "Address"("userId", "orderId");

-- A single default per customer/category is enforced in the database. Partial
-- indexes are required because order address snapshots also carry userId.
CREATE UNIQUE INDEX IF NOT EXISTS "Address_default_shipping_per_user"
  ON "Address"("userId")
  WHERE "isDefaultShipping" = true AND "userId" IS NOT NULL AND "orderId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Address_default_billing_per_user"
  ON "Address"("userId")
  WHERE "isDefaultBilling" = true AND "userId" IS NOT NULL AND "orderId" IS NULL;

-- Fulfilment metadata and cancellation bookkeeping.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "carrier" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryReservedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inventoryRestoredAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OrderTrackingEvent" (
  "id" SERIAL NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "source" "TrackingEventSource" NOT NULL DEFAULT 'SYSTEM',
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderTrackingEvent_orderId_status_key"
  ON "OrderTrackingEvent"("orderId", "status");
CREATE INDEX IF NOT EXISTS "OrderTrackingEvent_orderId_createdAt_idx"
  ON "OrderTrackingEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderTrackingEvent_createdBy_idx"
  ON "OrderTrackingEvent"("createdBy");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderTrackingEvent_orderId_fkey'
  ) THEN
    ALTER TABLE "OrderTrackingEvent"
      ADD CONSTRAINT "OrderTrackingEvent_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderTrackingEvent_createdBy_fkey'
  ) THEN
    ALTER TABLE "OrderTrackingEvent"
      ADD CONSTRAINT "OrderTrackingEvent_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing COD orders were created by the current checkout, which decrements
-- stock before persisting. Mark those reservations so cancellation can restore
-- stock exactly once. Cancelled orders are left untouched (their stock state is
-- historical and must not be changed retroactively).
UPDATE "Order" AS o
SET "inventoryReservedAt" = o."createdAt"
FROM "Payment" AS p
WHERE p."orderId" = o."id"
  AND p."provider" = 'cod'
  AND o."status" <> 'CANCELLED'
  AND o."inventoryReservedAt" IS NULL;
