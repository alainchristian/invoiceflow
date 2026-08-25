-- CreateEnum
CREATE TYPE "InvoiceDiscountType" AS ENUM ('FLAT', 'PERCENT');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "invoiceDiscountType" "InvoiceDiscountType" NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "invoiceDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "poNumber" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "invoiceDiscountType" "InvoiceDiscountType" NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "invoiceDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "poNumber" TEXT;

-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "generateAsDraft" BOOLEAN NOT NULL DEFAULT false;
