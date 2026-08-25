-- Monetary fields were Float (double precision), which can accumulate binary
-- floating-point rounding error in currency math (tax/discount stacking).
-- Moving to DECIMAL(14,2) for exact base-10 arithmetic. Existing values are
-- cast losslessly at 2dp precision -- double precision safely represents
-- currency-range amounts, so no data is lost by this cast.

-- AlterTable
ALTER TABLE "CreditNote"
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2) USING "subtotal"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(14,2) USING "taxTotal"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2);

-- AlterTable
ALTER TABLE "CreditNoteItem"
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING "unitPrice"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2);

-- AlterTable
ALTER TABLE "Invoice"
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2) USING "subtotal"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(14,2) USING "taxTotal"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2),
ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(14,2) USING "amountPaid"::numeric(14,2),
ALTER COLUMN "invoiceDiscountValue" SET DATA TYPE DECIMAL(14,2) USING "invoiceDiscountValue"::numeric(14,2);

-- AlterTable
ALTER TABLE "InvoiceItem"
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING "unitPrice"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2);

-- AlterTable
ALTER TABLE "Payment"
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING "amount"::numeric(14,2);

-- AlterTable
ALTER TABLE "Product"
ALTER COLUMN "defaultPrice" SET DATA TYPE DECIMAL(14,2) USING "defaultPrice"::numeric(14,2);

-- AlterTable
ALTER TABLE "Quote"
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2) USING "subtotal"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "taxTotal" SET DATA TYPE DECIMAL(14,2) USING "taxTotal"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2),
ALTER COLUMN "invoiceDiscountValue" SET DATA TYPE DECIMAL(14,2) USING "invoiceDiscountValue"::numeric(14,2);

-- AlterTable
ALTER TABLE "QuoteItem"
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING "unitPrice"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,2) USING "total"::numeric(14,2);

-- AlterTable
ALTER TABLE "RecurringInvoiceItem"
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2) USING "unitPrice"::numeric(14,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,2) USING "discount"::numeric(14,2);
