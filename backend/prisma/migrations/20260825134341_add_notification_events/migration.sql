-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_VIEWED';
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_PAID';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_ACCEPTED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "quoteId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_quoteId_idx" ON "Notification"("quoteId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
