CREATE TABLE IF NOT EXISTS "Address" (
  "id" SERIAL NOT NULL,
  "userId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'shipping',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "company" TEXT,
  "phone" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'USA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Address_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
