-- Backfilled for existing rows before the NOT NULL/UNIQUE constraints are
-- applied, since ADD COLUMN ... NOT NULL has no data to satisfy the
-- constraint otherwise. gen_random_uuid() matches the same uuid() default
-- Prisma applies at the application layer for new rows going forward.
ALTER TABLE "Customer" ADD COLUMN "portalToken" TEXT;

UPDATE "Customer" SET "portalToken" = gen_random_uuid()::text WHERE "portalToken" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "portalToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_portalToken_key" ON "Customer"("portalToken");
