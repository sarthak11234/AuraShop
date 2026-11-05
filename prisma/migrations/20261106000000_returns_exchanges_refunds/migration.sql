-- Phase 12.2 returns, exchanges & refunds: additive-only schema changes.
-- Existing users, orders, payments, refunds, inventory and account records
-- are untouched. No tables are dropped or truncated.

CREATE TYPE "ReturnStatus" AS ENUM (
  'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED',
  'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTION_PENDING', 'INSPECTED',
  'REFUND_PENDING', 'REFUND_PROCESSING', 'REFUNDED',
  'EXCHANGE_PENDING', 'EXCHANGE_PROCESSING', 'EXCHANGED', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "ReturnReason" AS ENUM (
  'WRONG_SIZE', 'WRONG_PRODUCT', 'DAMAGED', 'DEFECTIVE',
  'DIFFERS_FROM_DESCRIPTION', 'QUALITY_ISSUE', 'OTHER'
);

CREATE TYPE "ReturnType" AS ENUM ('REFUND', 'EXCHANGE');

CREATE TYPE "ItemCondition" AS ENUM (
  'UNOPENED', 'LIKE_NEW', 'GOOD', 'DAMAGED', 'DEFECTIVE', 'INCOMPLETE', 'OTHER'
);

CREATE TYPE "RefundMethod" AS ENUM ('RAZORPAY', 'BANK_TRANSFER', 'UPI', 'OTHER');

CREATE TYPE "OfflineRefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE "ReturnEventSource" AS ENUM ('SYSTEM', 'ADMIN', 'CUSTOMER', 'CARRIER');

CREATE TYPE "ExchangeStatus" AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'STOCK_RESERVED', 'DISPATCHED', 'COMPLETED', 'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "ReturnRequest" (
  "id" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "returnReason" "ReturnReason" NOT NULL,
  "returnType" "ReturnType" NOT NULL DEFAULT 'REFUND',
  "customerComments" TEXT,
  "adminNotes" TEXT,
  "customerNotes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "refundAmount" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReturnItem" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "productTitle" TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "productImage" TEXT,
  "variantId" TEXT,
  "size" TEXT,
  "requestedQuantity" INTEGER NOT NULL,
  "approvedQuantity" INTEGER NOT NULL DEFAULT 0,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
  "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
  "condition" "ItemCondition",
  "restockable" BOOLEAN NOT NULL DEFAULT false,
  "price" DECIMAL(10,2) NOT NULL,
  "lineTotal" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReturnStatusEvent" (
  "id" SERIAL NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "source" "ReturnEventSource" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReturnShipment" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "shippedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReturnInspection" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "returnItemId" TEXT NOT NULL,
  "receivedQuantity" INTEGER NOT NULL,
  "inspectedQuantity" INTEGER NOT NULL,
  "acceptedQuantity" INTEGER NOT NULL,
  "rejectedQuantity" INTEGER NOT NULL,
  "condition" "ItemCondition" NOT NULL,
  "restockable" BOOLEAN NOT NULL DEFAULT false,
  "inspectionNotes" TEXT,
  "inspectedAt" TIMESTAMP(3) NOT NULL,
  "inspectorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExchangeRequest" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING',
  "replacementProductId" TEXT NOT NULL,
  "replacementVariantId" TEXT,
  "replacementQuantity" INTEGER NOT NULL,
  "priceDifference" DECIMAL(10,2),
  "reservedAt" TIMESTAMP(3),
  "reservedStockRestoredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OfflineRefund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "method" "RefundMethod" NOT NULL,
  "transactionReference" TEXT NOT NULL,
  "status" "OfflineRefundStatus" NOT NULL DEFAULT 'PENDING',
  "actorId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfflineRefund_pkey" PRIMARY KEY ("id")
);

-- Unique constraints and indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ReturnShipment_returnRequestId_key" ON "ReturnShipment"("returnRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "OfflineRefund_returnRequestId_key" ON "OfflineRefund"("returnRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRequest_returnRequestId_key" ON "ExchangeRequest"("returnRequestId");

CREATE INDEX IF NOT EXISTS "ReturnRequest_userId_idx" ON "ReturnRequest"("userId");
CREATE INDEX IF NOT EXISTS "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX IF NOT EXISTS "ReturnRequest_status_idx" ON "ReturnRequest"("status");
CREATE INDEX IF NOT EXISTS "ReturnRequest_createdAt_idx" ON "ReturnRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "ReturnItem_returnRequestId_idx" ON "ReturnItem"("returnRequestId");
CREATE INDEX IF NOT EXISTS "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");
CREATE INDEX IF NOT EXISTS "ReturnItem_variantId_idx" ON "ReturnItem"("variantId");
CREATE INDEX IF NOT EXISTS "ReturnStatusEvent_returnRequestId_createdAt_idx" ON "ReturnStatusEvent"("returnRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReturnStatusEvent_returnRequestId_status_idx" ON "ReturnStatusEvent"("returnRequestId", "status");
CREATE INDEX IF NOT EXISTS "ReturnInspection_returnRequestId_idx" ON "ReturnInspection"("returnRequestId");
CREATE INDEX IF NOT EXISTS "ReturnInspection_returnItemId_idx" ON "ReturnInspection"("returnItemId");
CREATE INDEX IF NOT EXISTS "ReturnInspection_inspectorId_createdAt_idx" ON "ReturnInspection"("inspectorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExchangeRequest_returnRequestId_idx" ON "ExchangeRequest"("returnRequestId");
CREATE INDEX IF NOT EXISTS "ExchangeRequest_userId_idx" ON "ExchangeRequest"("userId");
CREATE INDEX IF NOT EXISTS "ExchangeRequest_orderId_idx" ON "ExchangeRequest"("orderId");
CREATE INDEX IF NOT EXISTS "ExchangeRequest_status_idx" ON "ExchangeRequest"("status");
CREATE INDEX IF NOT EXISTS "OfflineRefund_orderId_idx" ON "OfflineRefund"("orderId");
CREATE INDEX IF NOT EXISTS "OfflineRefund_status_idx" ON "OfflineRefund"("status");

-- Foreign keys (guarded so the migration is re-runnable).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnRequest_userId_fkey') THEN
    ALTER TABLE "ReturnRequest"
      ADD CONSTRAINT "ReturnRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnRequest_orderId_fkey') THEN
    ALTER TABLE "ReturnRequest"
      ADD CONSTRAINT "ReturnRequest_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnItem_returnRequestId_fkey') THEN
    ALTER TABLE "ReturnItem"
      ADD CONSTRAINT "ReturnItem_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnItem_orderItemId_fkey') THEN
    ALTER TABLE "ReturnItem"
      ADD CONSTRAINT "ReturnItem_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnItem_productId_fkey') THEN
    ALTER TABLE "ReturnItem"
      ADD CONSTRAINT "ReturnItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnItem_variantId_fkey') THEN
    ALTER TABLE "ReturnItem"
      ADD CONSTRAINT "ReturnItem_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnStatusEvent_returnRequestId_fkey') THEN
    ALTER TABLE "ReturnStatusEvent"
      ADD CONSTRAINT "ReturnStatusEvent_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnStatusEvent_actorId_fkey') THEN
    ALTER TABLE "ReturnStatusEvent"
      ADD CONSTRAINT "ReturnStatusEvent_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnShipment_returnRequestId_fkey') THEN
    ALTER TABLE "ReturnShipment"
      ADD CONSTRAINT "ReturnShipment_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnInspection_returnRequestId_fkey') THEN
    ALTER TABLE "ReturnInspection"
      ADD CONSTRAINT "ReturnInspection_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnInspection_returnItemId_fkey') THEN
    ALTER TABLE "ReturnInspection"
      ADD CONSTRAINT "ReturnInspection_returnItemId_fkey"
      FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReturnInspection_inspectorId_fkey') THEN
    ALTER TABLE "ReturnInspection"
      ADD CONSTRAINT "ReturnInspection_inspectorId_fkey"
      FOREIGN KEY ("inspectorId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExchangeRequest_returnRequestId_fkey') THEN
    ALTER TABLE "ExchangeRequest"
      ADD CONSTRAINT "ExchangeRequest_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExchangeRequest_userId_fkey') THEN
    ALTER TABLE "ExchangeRequest"
      ADD CONSTRAINT "ExchangeRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExchangeRequest_orderId_fkey') THEN
    ALTER TABLE "ExchangeRequest"
      ADD CONSTRAINT "ExchangeRequest_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExchangeRequest_replacementProductId_fkey') THEN
    ALTER TABLE "ExchangeRequest"
      ADD CONSTRAINT "ExchangeRequest_replacementProductId_fkey"
      FOREIGN KEY ("replacementProductId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExchangeRequest_replacementVariantId_fkey') THEN
    ALTER TABLE "ExchangeRequest"
      ADD CONSTRAINT "ExchangeRequest_replacementVariantId_fkey"
      FOREIGN KEY ("replacementVariantId") REFERENCES "ProductVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfflineRefund_orderId_fkey') THEN
    ALTER TABLE "OfflineRefund"
      ADD CONSTRAINT "OfflineRefund_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfflineRefund_returnRequestId_fkey') THEN
    ALTER TABLE "OfflineRefund"
      ADD CONSTRAINT "OfflineRefund_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfflineRefund_actorId_fkey') THEN
    ALTER TABLE "OfflineRefund"
      ADD CONSTRAINT "OfflineRefund_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
