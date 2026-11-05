ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "Product"
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "categoryId" TEXT;

ALTER TABLE "ProductVariant"
  ADD COLUMN "sku" TEXT;

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Category" ("id", "name", "slug", "isPublished", "createdAt", "updatedAt")
SELECT
  'cat_' || md5(slug),
  MIN("category"),
  slug,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    "category",
    COALESCE(
      NULLIF(lower(regexp_replace(trim("categoryCode"), '[^a-zA-Z0-9]+', '-', 'g')), ''),
      NULLIF(lower(regexp_replace(trim("category"), '[^a-zA-Z0-9]+', '-', 'g')), '')
    ) AS slug
  FROM "Product"
) AS categories
WHERE slug <> ''
GROUP BY slug;

UPDATE "Product" AS product
SET "categoryId" = category.id
FROM "Category" AS category
WHERE COALESCE(
  NULLIF(lower(regexp_replace(trim(product."categoryCode"), '[^a-zA-Z0-9]+', '-', 'g')), ''),
  NULLIF(lower(regexp_replace(trim(product."category"), '[^a-zA-Z0-9]+', '-', 'g')), '')
) = category.slug;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_isPublished_archivedAt_idx" ON "Product"("isPublished", "archivedAt");

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAdjustment" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "previousQuantity" INTEGER NOT NULL,
  "newQuantity" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminRateLimit" (
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AdminRateLimit_pkey" PRIMARY KEY ("actorId", "action", "windowStart")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX "InventoryAdjustment_variantId_createdAt_idx" ON "InventoryAdjustment"("variantId", "createdAt");
CREATE INDEX "InventoryAdjustment_actorId_createdAt_idx" ON "InventoryAdjustment"("actorId", "createdAt");
CREATE INDEX "AdminRateLimit_windowStart_idx" ON "AdminRateLimit"("windowStart");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAdjustment"
  ADD CONSTRAINT "InventoryAdjustment_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAdjustment"
  ADD CONSTRAINT "InventoryAdjustment_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminRateLimit"
  ADD CONSTRAINT "AdminRateLimit_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
