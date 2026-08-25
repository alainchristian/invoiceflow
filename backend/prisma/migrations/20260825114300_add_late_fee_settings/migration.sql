-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "lateFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateFeeType" "InvoiceDiscountType" NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "lateFeeValue" DECIMAL(14,2) NOT NULL DEFAULT 0;
